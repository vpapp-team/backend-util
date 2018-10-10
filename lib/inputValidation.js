const LOGGER = new (require('backend-logger'))().is.UTIL();
// TYPES get loaded in later to prevent circular require
let TYPES;

// Validate a version
exports.validateVersion = (dataVersion, varname = 'version', canBeNull = false) => {
  if (!TYPES) TYPES = require('backend-types');
  const VERSION = TYPES.get('General').get('Version');
  if (dataVersion instanceof VERSION) return dataVersion;
  try {
    return new VERSION(dataVersion);
  } catch (e) {
    throw new TypeError(`${varname}${canBeNull ? ' not null nor a valid Version: ' : ' invalid: '}${e.message}`);
  }
};

// Validate a boolean
exports.validateBoolean = (dataBool, varname, canBeNull = false) => {
  if (!varname) throw new Error('no varname provided');
  if (typeof dataBool === 'number') dataBool = dataBool === 1;
  if (typeof dataBool !== 'boolean') throw new TypeError(`${varname} not a boolean${canBeNull ? ' nor null' : ''}.`);
  return dataBool;
};

// Validate a UUID
exports.validateUUID = (dataUUID, varname = 'uuid', canBeNull = false) => {
  if (!TYPES) TYPES = require('backend-types');
  const UUID = TYPES.get('General').get('UUID');
  if (dataUUID instanceof UUID) return dataUUID;
  try {
    return new UUID(dataUUID);
  } catch (e) {
    throw new TypeError(`${varname}${canBeNull ? ' not null nor a valid UUID: ' : ' invalid: '}${e.message}`);
  }
};

// Validate a Time
exports.validateTime = (dataTime, varname = 'time', canBeNull = false) => {
  if (!TYPES) TYPES = require('backend-types');
  const TIME = TYPES.get('General').get('Time');
  if (dataTime instanceof TIME) return dataTime;
  try {
    return new TIME(dataTime);
  } catch (e) {
    throw new TypeError(`${varname}${canBeNull ? ' not null nor a valid Time: ' : ' invalid: '}${e.message}`);
  }
};

// Validate a Timetable
exports.validateTimetable = (dataTimetable, varname = 'timetable', canBeNull = false) => {
  if (!TYPES) TYPES = require('backend-types');
  const TIMETABLE = TYPES.get('Data').get('Timetable');
  if (dataTimetable instanceof TIMETABLE) return dataTimetable;
  try {
    return new TIMETABLE(dataTimetable);
  } catch (e) {
    throw new TypeError(`${varname}${canBeNull ? ' not null nor a valid Timetable: ' : ' invalid: '}${e.message}`);
  }
};

// Validate a string
exports.validateString = (dataString, varname, canBeNull = false) => {
  if (!varname) throw new Error('no varname provided');
  if (typeof dataString === 'string') dataString = dataString.trim();
  if (!dataString || typeof dataString !== 'string') {
    throw new TypeError(`${varname} not a valid string${canBeNull ? ' nor null' : ''}.`);
  }
  return dataString;
};

// Validate a LessonDiscriminator
exports.validateLesson = (dataLesson, varname = 'lesson', canBeNull = false) => {
  if (!TYPES) TYPES = require('backend-types');
  const LESSON_DISCRIM = TYPES.get('General').get('LessonDiscriminator');
  if (dataLesson instanceof LESSON_DISCRIM) return dataLesson;
  try {
    return new LESSON_DISCRIM(dataLesson);
  } catch (e) {
    throw new TypeError(`${varname}${
      canBeNull ? ' not null nor a valid LessonDiscriminator: ' : ' invalid: '}${e.message}`);
  }
};

// Validate a ClassDiscriminator
exports.validateClass = (dataClass, varname = 'class', canBeNull = false) => {
  if (!TYPES) TYPES = require('backend-types');
  const CLASS_DISCRIM = TYPES.get('General').get('ClassDiscriminator');
  if (dataClass instanceof CLASS_DISCRIM) return dataClass;
  try {
    return new CLASS_DISCRIM(dataClass);
  } catch (e) {
    throw new TypeError(`${varname}${
      canBeNull ? ' not null nor a valid ClassDiscriminator: ' : ' invalid: '}${e.message}`);
  }
};

// Validate a integer
exports.validateInteger = (dataInt, varname, canBeNull = false) => {
  if (!varname) throw new Error('no varname provided');
  if (typeof dataInt !== 'number') throw new TypeError(`${varname} not a number${canBeNull ? ' nor null' : ''}.`);
  if (dataInt < 0 || Math.floor(dataInt) !== dataInt) {
    throw new TypeError(`${varname} not a valid integer${canBeNull ? ' nor null' : ''}.`);
  }
  return dataInt;
};

// Validate item in array, returns the index
exports.validateInStringArray = (data, varname, arrayData, ignoreCase = false) => {
  if (typeof data === 'string') {
    const _array = ignoreCase ? arrayData.map(a => a.toLowerCase()) : arrayData;
    const _data = ignoreCase ? data.trim().toLowerCase() : data.trim();
    const index = _array.indexOf(_data);
    if (index) return index;
  } else if (typeof data === 'number' &&
    data >= 0 &&
    Math.floor(data) === data &&
    data < arrayData.length) {
    return data;
  }
  return new TypeError(`${varname} is not one of the options`);
};

// Validate an array and its content
exports.validateArray = (dataArray, varname, itemValidationFunc, canBeEmpty = false) => {
  if (!dataArray && canBeEmpty) return [];
  if (!Array.isArray(dataArray)) throw new TypeError(`${varname} not an array`);
  if (!canBeEmpty && dataArray.length === 0) throw new TypeError(`${varname} is empty`);
  let resp = [];
  for (let a = 0; a < dataArray.length; a++) {
    try {
      resp[a] = itemValidationFunc(dataArray[a]);
    } catch (e) {
      throw new TypeError(`not all items in ${varname} are of the right type`);
    }
  }
  return resp;
};

// Validate an empty array, prefs null over empty array
exports.validateOptionalArray = (dataArray, varname, itemValidationFunc) => {
  if (!dataArray) return null;
  if (!Array.isArray(dataArray)) throw new TypeError(`${varname} not an array nor null.`);
  if (dataArray.length === 0) return null;
  let resp = [];
  for (let a = 0; a < dataArray.length; a++) {
    try {
      resp[a] = itemValidationFunc(dataArray[a]);
    } catch (e) {
      throw new TypeError(`not all items in ${varname} are of the right type`);
    }
  }
  return resp;
};

// Validate an item that can be null
exports.validateNullable = (data, varname, dataTester) => {
  if (!data) return null;
  return dataTester(data, varname, true);
};

// Validate LessonRange#time
const RANGE_REGEXP = /^([0-9]{1,2}:[0-9]{1,2})?-[0-9]{1,2}:[0-9]{1,2}$|^[0-9]{1,2}:[0-9]{1,2}-$/;
const RANGE_PART = /^[0-9]{1,2}:[0-9]{1,2}$/;
exports.validateLessonRangesTime = dataTime => {
  if (typeof dataTime === 'string') {
    dataTime = dataTime.trim();
    if (!dataTime.match(RANGE_REGEXP)) throw new TypeError('time string has wrong format');
    const parts = dataTime.split('-');
    return {
      start: parts[0] || null,
      end: parts[1] || null,
    };
  } else if (typeof dataTime === 'object') {
    if (typeof dataTime.start !== 'string') throw new TypeError('time.start not a string');
    if (dataTime.start && !dataTime.start.match(RANGE_PART)) throw new TypeError('time has invalid start');
    if (typeof dataTime.end !== 'string') throw new TypeError('time.end not a string');
    if (dataTime.end && !dataTime.end.match(RANGE_PART)) throw new TypeError('time has invalid end');
    return {
      start: dataTime.start || null,
      end: dataTime.end || null,
    };
  } else {
    throw new TypeError('time not string nor object');
  }
};
// Validate Timetable#lessons
exports.validateTimetablesLessons = (dataContent, dataLessons, dataUUID) => {
  if (!TYPES) TYPES = require('backend-types');
  // When done also update README in backend-util...
  LOGGER.log('validateTimetablesLessons', { dataContent, dataLessons, dataUUID });
  // From web parser?
  if (dataLessons) throw new Error('!!Timetable with lessons');
  // From db?
  if (dataContent) throw new Error('!!Timetable with content');
  // What is the dataUUID?
  if (dataUUID) throw new Error('!!Timetable with UUID');

  if (dataContent && typeof dataContent === 'string') {
    try {
      dataLessons = JSON.parse(dataContent);
    } catch (e) {
      throw new TypeError(`content invalid: ${e.message}`);
    }
  }
  const LESSON = TYPES.get('Data').get('Lesson');
  if (!Array.isArray(dataLessons)) throw new TypeError('lessons not an array');
  return dataLessons.map(a =>
    // DataUUID wenn als dataLessons?
    // masterUUID oder dataUUID wenn dataContent?
    a instanceof LESSON ? a : new LESSON(a, a.masterUUID || dataUUID)
  );
};
