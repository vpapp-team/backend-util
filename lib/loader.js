// LOADER IGNORE //
const FS = require('fs');
const PATH = require('path');

const EXT_NAMES = '.js,.json'.split(',');

// TODO: make parallel
const readDir = module.exports = (dir, master, reload = false) => {
  const resp = new Map();
  resp.dir = master ? PATH.resolve(master, dir) : PATH.resolve(dir);
  const files = FS.readdirSync(resp.dir);
  if (files.includes('.ignore')) return resp;
  const stats = files.map(file => FS.statSync(PATH.resolve(resp.dir, file)));
  for (let a = 0; a < files.length; a++) {
    const file = files[a];
    const stat = stats[a];
    if (stat.isFile() && EXT_NAMES.includes(PATH.extname(file).toLowerCase())) {
      if (reload) delete require.cache[require.resolve(PATH.resolve(resp.dir, file))];
      let basename = file.slice(0, -PATH.extname(file).length);
      const parsedPath = PATH.resolve(resp.dir, file);
      if (!FS.readFileSync(parsedPath, 'utf8').startsWith('// LOADER IGNORE //')) {
        resp.set(basename, require(parsedPath));
      }
    }
    if (stat.isDirectory()) resp.set(file, readDir(file, resp.dir, reload));
  }
  return resp;
};
