const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../js/state.js');
const Days = require('../js/days.js');
const Dates = require('../js/dates.js');
const Week = require('../js/week.js');

const END = '2026-10-24';
const item = kcal => ({ name: 'x', grams: 100, kcal, protein: 20, fat: 5, carbs: 10, fiber: 0, sugar: 0, sodium: 0 });
const targets = () => ({ kcal: 1500, protein: 100, fat: 50, carbs: 150 });

function seeded() {
  const s = State.empty();
  // 5 ימים עם אוכל, 2 ריקים
  [1300, 1600, 1450, 0, 1200, 0, 1500].forEach((kcal, i) => {
    const d = Dates.addDays(END, -6 + i);
    if (kcal) Days.addItems(s, d, 'lunch', [item(kcal)]);
    Days.addWater(s, d, i < 2 ? 2 : 0);
    if (i === 6) Days.setSteps(s, d, 8000);
  });
  State.upsertMeasurement(s, { date: Dates.addDays(END, -10), weight: 75 });
  State.upsertMeasurement(s, { date: Dates.addDays(END, -6), weight: 74 });
  State.upsertMeasurement(s, { date: END, weight: 73.4 });
  return s;
}

test('window is the 7 days ending on endDate', () => {
  const w = Week.stats(seeded(), targets, END);
  assert.equal(w.from, '2026-10-18');
  assert.equal(w.to, END);
});

test('empty days are left out of averages and budget count', () => {
  const w = Week.stats(seeded(), targets, END);
  assert.equal(w.daysLogged, 5);
  assert.equal(w.avgKcal, 1410);
  assert.equal(w.avgProtein, 20);
  assert.equal(w.daysInBudget, 4);
});

test('weight change uses first and last weight inside the window', () => {
  const w = Week.stats(seeded(), targets, END);
  assert.equal(w.weightChange, -0.6);
});

test('weight change is null with fewer than 2 weights in the window', () => {
  const s = State.empty();
  State.upsertMeasurement(s, { date: END, weight: 70 });
  assert.equal(Week.stats(s, targets, END).weightChange, null);
});

test('water and steps average only days that have them', () => {
  const w = Week.stats(seeded(), targets, END);
  assert.equal(w.avgWater, 2);
  assert.equal(w.avgSteps, 8000);
});

test('no targets means no budget count', () => {
  const w = Week.stats(seeded(), () => null, END);
  assert.equal(w.daysInBudget, null);
});

test('a week with nothing logged is all zeros and nulls', () => {
  const w = Week.stats(State.empty(), targets, END);
  assert.equal(w.daysLogged, 0);
  assert.equal(w.avgKcal, null);
  assert.equal(w.avgWater, null);
});

test('budget days are counted out of the days that had targets', () => {
  const firstDay = Dates.addDays(END, -6);
  const w = Week.stats(seeded(), d => (d === firstDay ? null : targets()), END);
  assert.equal(w.daysWithTargets, 4);
  assert.equal(w.daysInBudget, 3);
});
