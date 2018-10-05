/*
 * Flake ID Generator => https://github.com/T-PWK/flake-idgen
 * Required Options
 * Options.epoche = Number => Offset for the included clock(including milliseconds)
 * Options.datacenter = Number => ID for the datacenter(0 reserved for manual)
 * Options.worker = Number => ID for the worker / cluster(0 reserved for manual)

10000110101011101110100001000111 0111 0011 000000000000     52 total length
                                          |------------|    12 bit counter (4096 possibilities)
                                     |----|                  4 bit worker (16 possibilities)
                                |----|                       4 bit datacenter (16 possibilities)
                                |---- ----|                  8 bit generator identifier
|-------------------------------|                           32 bit timestamp(seconds only)

*/

class FlakeId {
  constructor(options) {
    if (typeof options.epoche !== 'number') {
      throw new Error('epoche not a number');
    }
    if (typeof options.datacenter !== 'number') {
      throw new Error('datacenter not a number');
    }
    if (typeof options.worker !== 'number') {
      throw new Error('worker not a number');
    }
    if (options.worker > 15 || options.datacenter > 15) throw new Error('datacenter or worker to high');
    if (Math.floor(options.epoche) !== options.epoche || options.epoche < 0 || options.epoche > Date.now()) {
      throw new Error('invalid epoche provided');
    }
    // Set generator id from combination of 'datacenter' and 'worker'
    // id generator identifier - will not change while generating ids
    this.id = `${('0'.repeat(4) + options.datacenter.toString(2)).slice(-4)}${('0'.repeat(4) + options.worker.toString(2)).slice(-4)}`; // eslint-disable-line max-len
    this.epoche = options.epoche;
    this.seq = 0;
    this.lastTime = 0;
    this.overflow = false;
  }

  next(cb) {
    const now = Date.now();
    const time = Math.floor((now - this.epoche) / 1000);

    // Generates id in the same millisecond as the previous id
    if (time === this.lastTime) {
      // If all sequence values (4096 unique values including 0) have been used
      // to generate ids in the current millisecond (overflow is true) wait till next second
      if (this.overflow) {
        overflowCond(this, cb, now);
        return null;
      }

      // Increase sequence counter
      this.seq = (this.seq + 1) & 0xFFF;

      // Sequence counter exceeded its max value (4095)
      // - set overflow flag and wait till next second
      if (this.seq === 0) {
        this.overflow = true;
        overflowCond(this, cb, now);
        return null;
      }
    } else {
      this.overflow = false;
      this.seq = 0;
    }
    this.lastTime = time;

    const parsed = buildRange(Number(parseInt(`${
      ('0'.repeat(32) + Number(time).toString(2)).slice(-32)
    }${
      ('0'.repeat(8) + this.id.toString(2)).slice(-8)
    }${
      ('0'.repeat(12) + this.seq.toString(2)).slice(-12)
    }`, 2).toString(10)));

    if (cb) {
      process.nextTick(cb.bind(null, null, parsed));
      return null;
    } else { return parsed; }
  }

  undo(snowflake, base) {
    // Parse input into number object
    let num;
    if (typeof snowflake === 'number') num = snowflake;
    else if (base === 64) num = parseInt(main.Base64.toInt(snowflake), 10);
    else num = parseInt(snowflake, base);

    // Build the full 52 bit long int
    const fullBinary = ('0'.repeat(52) + num.toString(2)).slice(-52);

    // Split into it's parts and return
    return {
      timestamp: buildRange(parseInt(fullBinary.substr(0, 32), 2)),
      seq: buildRange(parseInt(fullBinary.substr(40, 12), 2)),
      datacenter: buildRange(parseInt(fullBinary.substr(32, 4), 2)),
      worker: buildRange(parseInt(fullBinary.substr(36, 4), 2)),
      epoche: this.epoche,
      createdAt: new Date((parseInt(fullBinary.substr(0, 32), 2) * 1000) + this.epoche),
    };
  }
}
const main = module.exports = FlakeId;

function overflowCond(self, cb, time) {
  if (!cb) throw new Error('Sequence exceeded its maximum value. Provide callback function to handle sequence overflow'); // eslint-disable-line max-len
  setTimeout(self.next.bind(self, cb), 1000 - (time % 1000));
}

function buildRange(num) {
  return {
    num: num,
    base2: num.toString(2),
    base10: num.toString(10),
    base64: main.Base64.fromInt(num),
  };
}

// https://stackoverflow.com/questions/6213227/fastest-way-to-convert-a-number-to-radix-64-in-javascript
main.Base64 = {
//          0       8       16      24      32      40      48      56     63
//          v       v       v       v       v       v       v       v      v
  _Rixits: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-',
  _Test: string => string.match(/^[0-9A-Za-z+-]+$/),
  // Only works for natural numbers
  fromInt: function fromInt(number) {
    if (typeof number !== 'number') throw new Error('not a number provided');
    if (Math.floor(number) !== number || number < 0 || number > Number.MAX_SAFE_INTEGER) {
      throw new Error('not a valid natural numbers');
    }
    let rixit;
    let residual = Math.floor(number);
    let result = '';
    do {
      rixit = residual % 64;
      result = this._Rixits.charAt(rixit) + result;
      residual = Math.floor(residual / 64);
    } while (residual !== 0);
    return result;
  },
  toInt: function toInt(rixits) {
    if (typeof rixits !== 'string' || !this._Test(rixits)) throw new Error('not a valid string provided');
    if (rixits.length > 9) throw new Error('2 large number');
    let result = 0;
    rixits = rixits.split('');
    for (let e = 0; e < rixits.length; e++) {
      result = (result * 64) + this._Rixits.indexOf(rixits[e]);
    }
    return result;
  },
};
