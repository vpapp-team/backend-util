const EE = require('events').EventEmitter;
const PATH = require('path');
const FS = require('fs');

const HTTPS_CERT_CHANGE_DELAY = 1 * 60 * 1000;
class HTTPS_CERTS extends EE {
  constructor(dirname, options) {
    if (typeof dirname === 'object' && !options) {
      options = dirname;
      dirname = null;
    }
    super();
    this._pfx = this._key = this._passphrase = this._cert = this._ca = null;
    if (options.pfx) this._pfx = dirname ? PATH.resolve(dirname, options.pfx) : options.pfx;
    if (options.key) this._key = dirname ? PATH.resolve(dirname, options.key) : options.key;
    if (options.passphrase) this._passphrase = dirname ? PATH.resolve(dirname, options.passphrase) : options.passphrase;
    if (options.cert) this._cert = dirname ? PATH.resolve(dirname, options.cert) : options.cert;
    if (options.ca) this._ca = dirname ? PATH.resolve(dirname, options.ca) : options.ca;

    this.files = [];
    if (this._pfx) this.files.push(this._pfx);
    if (this._key) this.files.push(this._key);
    if (this._passphrase) this.files.push(this._passphrase);
    if (this._cert) this.files.push(this._cert);
    if (this._ca) this.files.push(this._ca);

    this.changeTimeout = null;
    this.watcher = null;
    this.registerWatcher();
  }

  getCredentials() {
    return {
      ca: this._ca ? FS.readFileSync(this._ca) : undefined,
      cert: this._cert ? FS.readFileSync(this._cert) : undefined,
      passphrase: this._passphrase ? FS.readFileSync(this._passphrase) : undefined,
      key: this._key ? FS.readFileSync(this._key) : undefined,
      pfx: this._pfx ? FS.readFileSync(this._pfx) : undefined,
    };
  }

  registerWatcher() {
    this.watcher = this.files.filter(FS.existsSync).map(file => FS.watch(file, () => {
      clearInterval(this.changeTimeout);
      setTimeout(this._notifyChange.bind(this), HTTPS_CERT_CHANGE_DELAY);
    }));
  }
  _notifyChange() {
    for (const watcher of this.watcher) watcher.close();
    this.emit('CHANGE');
  }
}

module.exports = HTTPS_CERTS;
