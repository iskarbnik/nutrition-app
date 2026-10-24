const test = require('node:test');
const assert = require('node:assert/strict');
const Targets = require('../js/targets.js');

const her = { sex: 'female', birthYear: 1996, height: 165, activity: 1.375 };
const ON = '2026-10-24';

test('Mifflin-St Jeor targets for a woman without body fat', () => {
  const t = Targets.compute(her, { weight: 72 }, ON);
  assert.ok(Math.abs(t.bmr - 1440.25) < 0.01);
  assert.equal(t.kcal, 1480);
  assert.equal(t.protein, 115);
  assert.equal(t.fat, 44);
  assert.equal(t.carbs, 156);
  assert.equal(t.fiber, 25);
  assert.equal(t.floored, false);
});

test('Katch-McArdle when body fat is known', () => {
  const t = Targets.compute(her, { weight: 72, fat: 31 }, ON);
  assert.ok(Math.abs(t.bmr - 1443.09) < 0.01);
});

test('male floor of 1500 kcal', () => {
  const him = { sex: 'male', birthYear: 1950, height: 160, activity: 1.2 };
  const t = Targets.compute(him, { weight: 55 }, ON);
  assert.equal(t.kcal, 1500);
  assert.equal(t.floored, true);
});

test('kcal override recomputes fat and carbs', () => {
  const t = Targets.compute({ ...her, overrides: { kcal: 1600 } }, { weight: 72 }, ON);
  assert.equal(t.kcal, 1600);
  assert.equal(t.fat, 48);
  assert.equal(t.carbs, 177);
});

test('missing data returns null', () => {
  assert.equal(Targets.compute({ ...her, sex: null }, { weight: 72 }, ON), null);
  assert.equal(Targets.compute({ ...her, height: null }, { weight: 72 }, ON), null);
  assert.equal(Targets.compute({ ...her, birthYear: null }, { weight: 72 }, ON), null);
  assert.equal(Targets.compute(her, null, ON), null);
  assert.equal(Targets.compute(her, { fat: 30 }, ON), null);
});
