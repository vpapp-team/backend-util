const URL = require('url');
const FS = require('fs');
const HTML_ENTITIES = require('html-entities');
const HTTP = require('http');
const HTTPS = require('https');
const CLUSTER = require('cluster');
const CRYPTO = require('crypto');

const SQL_QUERY_RETRY_DELAY = 10 * 1000;

/*
 * Denie/accept http(s) request
 */
const denie = exports.denie = (resp, msg, headerOverwrite, errorCode = 400) => {
  const content = JSON.stringify({ error: msg });
  resp.writeHead(errorCode, Object.assign({
    'content-type': 'application/json',
  }, msg ? { 'content-length': Buffer.byteLength(content) } : {}, headerOverwrite ? headerOverwrite : {}));
  if (msg) resp.write(content);
  resp.end();
};
exports.accept = (resp, data, headerOverwrite, statusCode = 200) => {
  const content = JSON.stringify(data);
  resp.writeHead(statusCode, Object.assign({
    'content-type': 'application/json',
  }, data ? { 'content-length': Buffer.byteLength(content) } : {}, headerOverwrite ? headerOverwrite : {}));
  if (data) resp.write(content);
  resp.end();
};
exports.acceptFile = (resp, filePath, headerOverwrite, range, statusCode = 200) => {
  FS.stat(filePath, (err, stats) => {
    if (err) {
      console.error('failed to stat file', filePath, err); // eslint-disable-line no-console
      denie(resp, 'something went wrong', null, 500);
    } else if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const startChunk = parseInt(parts[0], 10);
      if (!startChunk || isNaN(startChunk)) denie(resp, 'invalid range provided');
      const endChunk = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      if (!endChunk || isNaN(endChunk)) denie(resp, 'invalid range provided');
      const chunkSize = (endChunk - startChunk) + 1;
      resp.writeHead(206, Object.assign({
        'content-type': 'application/json',
        'content-range': `bytes ${startChunk}-${endChunk}/${stats.size}`,
        'accept-ranges': 'bytes',
        'content-length': chunkSize,
      }, headerOverwrite ? headerOverwrite : {}));
      FS.createReadStream(filePath, { start: startChunk, end: endChunk }).pipe(resp);
    } else {
      resp.writeHead(statusCode, Object.assign({
        'content-type': 'application/json',
        'content-length': stats.size,
      }, headerOverwrite ? headerOverwrite : {}));
      FS.createReadStream(filePath).pipe(resp);
    }
  });
};

/*
 * Build up communication between client & master
 */
const awaitedReturns = new Map();
exports.requestMaster = (api, cb, ...args) => {
  console.log('requestMaster', api, !!cb, args); // eslint-disable-line no-console
  const taskUUID = process.snowflake.next().base64;
  awaitedReturns.set(taskUUID, {
    uuid: taskUUID,
    cb,
  });
  process.send({
    type: 'masterRequest',
    uuid: taskUUID,
    get: api,
    args,
  });
};
if (CLUSTER.isWorker) {
  process.on('message', msg => {
    console.log('messageMaster', msg, awaitedReturns, !msg.uuid, !awaitedReturns.has(msg.uuid)); // eslint-disable-line no-console, max-len
    if (msg.type !== 'masterRequest') return;
    if (!msg.uuid) return;
    if (!awaitedReturns.has(msg.uuid)) return;
    awaitedReturns.get(msg.uuid).cb(msg.data);
    awaitedReturns.delete(msg.uuid);
  });
}

/*
 * Promise to return the body of a http(s) request
 */
const getBody = exports.getBody = (request, cb) => {
  // Cb since using a promise would auto 400 get requests with body
  if (!cb) {
    return new Promise((resolve, reject) => getBody(request, (err, body) => {
      if (err) return reject(err);
      return resolve(body);
    }));
  }
  const length = Number(request.headers['content-length']);
  if (!length || isNaN(length) || length < 1) {
    return cb(new Error('expecting a body and therefor a content-length header with ur request'));
  }
  const chunks = [];
  let dwLength = 0;
  const chunkListener = chunk => {
    dwLength += chunk.length;
    if (dwLength <= length) return chunks.push(chunk);

    request.removeListener('end', endListener);
    request.removeListener('data', chunkListener);
    return cb(new Error('body longer than content-length header'));
  };
  request.on('data', chunkListener);
  const endListener = () => {
    if (dwLength !== length) return cb(new Error('body length does not equal content-length header'));
    return cb(null, Buffer.concat(chunks));
  };
  request.on('end', endListener);
  return null;
};

/*
 * Simple `is a between b and c` function
 */
const betweenNum = exports.betweenNum = (worth, lowerBound, upperBound, toleranz = 0, inclusive = false) => {
  // Handle if lower and upper bound are switched
  if (lowerBound > upperBound) {
    return betweenNum(worth, upperBound, lowerBound, toleranz, inclusive);
  }
  if (inclusive) return lowerBound - toleranz <= worth && worth <= upperBound + toleranz;
  return lowerBound - toleranz < worth && worth < upperBound + toleranz;
};

/*
 * Resolves the provided ref as buffer
 */
const getWebpage = exports.getWebpage = (ref, paramOverwrites = {}, maxRedirects = 3) => new Promise((resolve, reject) => { // eslint-disable-line max-len
  if (typeof ref !== 'object') ref = URL.parse(ref);
  const reqParams = Object.assign({}, ref, paramOverwrites);
  const lib = reqParams.protocol === 'https:' ? HTTPS : HTTP;

  const body = [];
  const req = lib.get(reqParams, resp => {
    if (resp.statusCode === 302) {
      if (maxRedirects <= 0) {
        clearTimeout(timeout);
        return reject(new Error('too many redirects'));
      }
      clearTimeout(timeout);
      return getWebpage(resp.headers.location, paramOverwrites, maxRedirects - 1).then(resolve).catch(reject);
    } else if (resp.statusCode !== 200) {
      clearTimeout(timeout);
      return reject(new Error(`Unexpected Status Code: ${resp.statusCode}`));
    }
    resp.on('data', chunk => {
      body.push(chunk);
    });
    resp.on('end', () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(body));
    });
    return null;
  });
  req.on('error', e => {
    clearTimeout(timeout);
    return reject(e);
  });
  const timeout = setTimeout(reject, 30 * 1000, new Error('http get request timed out'));
});

/*
 * Add padding to a string
 */
exports.pad = (txt, width, z) => {
  z = `${z || 0}`;
  width = width || 1;
  const input = `${txt}`;
  return input.length >= width ? input : new Array(width - input.length + 1).join(z) + input;
};

/*
 * Remove all html from a string
 */
exports.removeHTML = html => new HTML_ENTITIES.AllHtmlEntities().decode(html
  .replace(/\n/g, ' ')
  .replace(/\s*<\s*br\s*\/?\s*>\s*/gi, '\n')
  .replace(/<\s*\/\s*p\s*>\s*<\s*p[^>]*>/gi, '\n')
  .replace(/<.*?>/gi, '')).trim();

/*
 * Removes all dublicate values from an array
 */
exports.unDoub = array => array.filter((item, pos, self) => self.indexOf(item) === pos);

/*
 * Promisifed mysql query
 */
const promisifiedQuery = exports.promisifiedQuery = (connectionOrPool, query, params, retrys = 3) => new Promise((resolve, reject) => { // eslint-disable-line max-len
  connectionOrPool.query(query, params, (err, rows) => {
    if (!err) return resolve(rows);
    if (retrys === 0) return reject(err);
    return setTimeout(() => {
      promisifiedQuery(connectionOrPool, query, params, retrys - 1).then(resolve).catch(reject);
    }, SQL_QUERY_RETRY_DELAY);
  });
});

/*
 * Extend Map since we want to load url's case insensitive via Loader.js
 */
Map.prototype.hasCaseInsensitive = function hasCaseInsensitive(targetKey) {
  const key = targetKey.toLowerCase();
  for (const [key2] of this) {
    if (key === key2.toLowerCase()) return true;
  }
  return false;
};
Map.prototype.getCaseInsensitive = function getCaseInsensitive(targetKey) {
  const key = targetKey.toLowerCase();
  for (const [key2, value] of this) {
    if (key === key2.toLowerCase()) return value;
  }
  return null;
};
Map.prototype.find = function find(fn) {
  for (const [key, val] of this) {
    if (fn(val, key, this)) return val;
  }
  return null;
};
Map.prototype.filter = function filter(fn) {
  const results = new Map();
  for (const [key, val] of this) {
    if (fn(val, key, this)) results.set(key, val);
  }
  return results;
};
Map.prototype.array = function array() {
  return [...this.values()];
};

/*
 * Password functions
 */
exports.genSalt = length => CRYPTO.randomBytes(Math.ceil(length / 2))
  .toString('hex')
  .slice(0, length);

exports.buildHash = (algorithm, password, salt) => CRYPTO.createHmac(algorithm, salt)
  .update(password)
  .digest('hex');

exports.parseDataStatus = (req, cb) => {
  getBody(req, (err, body) => {
    if (err) return cb(err);

    if (!body.toString()) return cb(null, { has: [] });
    try {
      const has = JSON.parse(body.toString()).has;
      if (!has || !Array.isArray(has)) return cb(null, { has: [] });
      return cb(null, { has });
    } catch (e) {
      return cb(new Error('invalid JSON provided'));
    }
  });
};

/*
 * Merge headers and cookie
 */
exports.handleCookie = (setCookie, headers) => {
  if (!headers) return setCookie.length ? { 'Set-Cookie': setCookie } : undefined;
  else return Object.assign(headers, setCookie.length ? { 'Set-Cookie': setCookie } : undefined);
};
