process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert/strict');
const Dates = require('../js/dates.js');

test('localDateKey uses the local date, not UTC', () => {
  // 00:30 in Israel (UTC+3) is still the previous day in UTC
  assert.equal(Dates.localDateKey(new Date('2026-10-23T21:30:00Z')), '2026-10-24');
});

test('toDay and fromDay round-trip', () => {
  assert.equal(Dates.fromDay(Dates.toDay('2026-03-31')), '2026-03-31');
});

test('addDays crosses year boundary', () => {
  assert.equal(Dates.addDays('2026-12-31', 1), '2027-01-01');
});

test('formatHe drops leading zeros', () => {
  assert.equal(Dates.formatHe('2026-03-05'), '5.3.2026');
});
