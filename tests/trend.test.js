const test = require('node:test');
const assert = require('node:assert/strict');
const Dates = require('../js/dates.js');
const Calc = require('../js/calc.js');

// 5 weekly points from 80, down 0.5 kg per week
const weekly = [80, 79.5, 79, 78.5, 78].map((value, i) => ({
  date: Dates.addDays('2026-09-01', i * 7),
  value,
}));
const last = weekly[weekly.length - 1].date;

test('trend measures weekly rate and estimates goal date', () => {
  const t = Calc.trend(weekly, 75);
  assert.ok(Math.abs(t.perWeek - -0.5) < 1e-9);
  assert.equal(t.approaching, true);
  assert.equal(t.reached, false);
  assert.equal(t.etaDate, Dates.addDays(last, 42));
});

test('trend needs at least 3 points', () => {
  assert.equal(Calc.trend(weekly.slice(0, 2), 75), null);
});

test('trend reports goal already reached', () => {
  const t = Calc.trend(weekly, 79);
  assert.equal(t.reached, true);
});
