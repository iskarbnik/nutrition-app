const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../js/state.js');

const v1 = {
  version: 1,
  profile: { name: 'נועה', birthYear: 1990, sex: 'female', height: 165, activity: 1.375, goalWeight: 65, goalFat: null },
  measurements: [{ date: '2026-10-01', weight: 72 }],
  days: {},
};

test('empty state has no personal defaults', () => {
  const s = State.empty();
  assert.equal(s.version, 2);
  assert.equal(s.profile.sex, null);
  assert.equal(s.profile.name, '');
  assert.equal(s.settings.aiProvider, 'gemini');
  assert.deepEqual(s.weekTips, {});
});

test('migrate keeps v1 data and adds new collections', () => {
  const s = State.migrate(v1);
  assert.equal(s.version, 2);
  assert.equal(s.profile.name, 'נועה');
  assert.equal(s.profile.waterGoal, 2.5);
  assert.deepEqual(s.measurements, v1.measurements);
  assert.deepEqual(s.savedMeals, []);
  assert.deepEqual(s.coffeeTypes, []);
  assert.equal(s.settings.aiProvider, 'gemini');
});

test('migrate of nothing is an empty state', () => {
  assert.deepEqual(State.migrate(null), State.empty());
});

test('validate accepts an empty state', () => {
  assert.equal(State.validate(State.empty()).ok, true);
});

test('validate rejects broken or newer files', () => {
  assert.equal(State.validate({}).ok, false);
  assert.equal(State.validate('text').ok, false);
  assert.equal(State.validate({ ...State.empty(), measurements: {} }).ok, false);
  const newer = State.validate({ ...State.empty(), version: 3 });
  assert.equal(newer.ok, false);
  assert.ok(newer.error);
});

test('upsertMeasurement replaces same date and updates height', () => {
  const s = State.migrate(v1);
  State.upsertMeasurement(s, { date: '2026-10-01', weight: 71.5, height: 166 });
  State.upsertMeasurement(s, { date: '2026-09-20', weight: 73 });
  assert.equal(s.measurements.length, 2);
  assert.equal(s.measurements[0].date, '2026-09-20');
  assert.equal(s.measurements[1].weight, 71.5);
  assert.equal(s.profile.height, 166);
});

test('latestMeasurement merges the newest known weight and fat', () => {
  const s = State.empty();
  State.upsertMeasurement(s, { date: '2026-10-01', weight: 72, fat: 31 });
  State.upsertMeasurement(s, { date: '2026-10-08', weight: 71.4 });
  assert.deepEqual(State.latestMeasurement(s), { weight: 71.4, fat: 31 });
  assert.equal(State.latestMeasurement(State.empty()), null);
});
