const URL = require('url');
const HTTP = require('http');
const HTTPS = require('https');
const CRYPTO = require('crypto');
const CLUSTER = require('cluster');
const HTML_ENTITIES = require('html-entities');

const SQL_QUERY_RETRY_DELAY = 10 * 1000;

const LOGGER = new (require('backend-logger'))().is.UTIL();
// TYPES get loaded in later to prevent circular require
let TYPES;

/*
 * Denie/accept http(s) request
 */
exports.denie = (resp, msg, headerOverwrite, errorCode = 400) => {
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

/*
 * Promise to return the body of a http(s) request
 */
const getBody = exports.getBody = (request, cb) => {
  // Cb since using a promise would auto 400 get requests with body
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
 * Merge headers and cookie
 */
exports.handleCookie = (setCookie, headers) => {
  if (!headers) return setCookie && setCookie.length ? { 'Set-Cookie': setCookie } : undefined;
  else return Object.assign(headers, setCookie && setCookie.length ? { 'Set-Cookie': setCookie } : undefined);
};

/*
 * Build up communication between client & master
 */
const awaitedReturns = new Map();
exports.requestMaster = (type, module, cb, ...args) => {
  if (!TYPES) TYPES = require('backend-types');
  LOGGER.debug('requestMaster', type, module, !!cb, args);
  const taskUUID = TYPES.get('General').get('UUID').new();
  awaitedReturns.set(taskUUID, {
    uuid: taskUUID,
    cb,
  });
  process.send({
    type,
    uuid: taskUUID,
    module,
    payload: null,
    args,
  });
};
if (CLUSTER.isWorker) {
  process.on('message', msg => {
    LOGGER.debug('messageMaster', msg, awaitedReturns, !msg.uuid, !awaitedReturns.has(msg.uuid));
    if (msg.type !== 'masterRequest') return;
    if (!msg.uuid) return;
    if (!awaitedReturns.has(msg.uuid)) return;
    awaitedReturns.get(msg.uuid).cb(msg.data);
    awaitedReturns.delete(msg.uuid);
  });
}

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
 * Add padding to a string
 */
exports.pad = (txt, width, z) => {
  z = `${z || 0}`;
  width = width || 1;
  const input = `${txt}`;
  return input.length >= width ? input : new Array(width - input.length + 1).join(z) + input;
};

/*
 * Removes all dublicate values from an array
 */
exports.unDoub = array => array.filter((item, pos, self) => self.indexOf(item) === pos);

/*
 * Parse basic api-request body
 */
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
 * Password functions
 */
exports.genSalt = length => CRYPTO.randomBytes(Math.ceil(length / 2))
  .toString('hex')
  .slice(0, length);
exports.buildHash = (algorithm = 'sha512', password, salt) => CRYPTO.createHmac(algorithm, salt)
  .update(password)
  .digest('hex');

/*
 * Sign data and validate signatures
 */
exports.sign = (data, privKey) => {
  const sign = CRYPTO.createSign('SHA256');
  sign.write(data);
  sign.end();
  return sign.sign(privKey).toString('hex');
};
exports.verifySignature = (data, signature, pubKey) => {
  const verify = CRYPTO.createVerify('SHA256');
  verify.write(data);
  verify.end();
  return verify.verify(pubKey, Buffer.from(signature, 'hex'));
};

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
 * Remove all html from a string
 */
String.prototype.removeHTML = function removeHTML() {
  return new HTML_ENTITIES.AllHtmlEntities().decode(this
    .trim()
    .replace(/\n/g, ' ')
    .replace(/\s*<\s*br\s*\/?\s*>\s*/gi, '\n')
    .replace(/<\s*\/\s*p\s*>\s*<\s*p[^>]*>/gi, '\n')
    .replace(/<.*?>/gi, '')
  ).trim();
};
/*
 * Simple `is a between b and c` function
 */
Number.prototype.betweenNum = function betweenNum(lowerBound, upperBound, toleranz = 0, inclusive = false) {
  // Handle if lower and upper bound are switched
  if (lowerBound > upperBound) {
    return this.betweenNum(upperBound, lowerBound, toleranz, inclusive);
  }
  if (inclusive) return lowerBound - toleranz <= this && this <= upperBound + toleranz;
  return lowerBound - toleranz < this && this < upperBound + toleranz;
};
