const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../js/state.js');
const Days = require('../js/days.js');

const D = '2026-10-24';
const item = (name, kcal, protein = 0, fat = 0, carbs = 0) =>
  ({ name, grams: 100, kcal, protein, fat, carbs, fiber: 1, sugar: 2, sodium: 50, source: 'list' });

function seeded() {
  const s = State.empty();
  s.coffeeTypes = [{ id: 'c1', name: 'הפוך', kcal: 90, protein: 5, fat: 3, carbs: 9, fiber: 0, sugar: 9, sodium: 60 }];
  Days.addItems(s, D, 'breakfast', [item('יוגורט', 150, 10, 5, 12), item('תפוח', 80, 0, 0, 20)]);
  Days.addItems(s, D, 'lunch', [item('עוף', 300, 40, 10, 0)]);
  Days.addCoffee(s, D, 'c1');
  return s;
}

test('totals add meals and coffee', () => {
  const t = Days.totals(seeded(), D);
  assert.equal(t.kcal, 620);
  assert.equal(t.protein, 55);
  assert.equal(t.fat, 18);
  assert.equal(t.carbs, 41);
  assert.equal(t.sodium, 210);
  assert.equal(t.byMeal.breakfast, 230);
  assert.equal(t.byMeal.lunch, 300);
  assert.equal(t.byMeal.dinner, 0);
});

test('totals on an empty date are zeros', () => {
  const t = Days.totals(State.empty(), D);
  assert.equal(t.kcal, 0);
  assert.equal(t.protein, 0);
});

test('remaining goes negative and flags over budget', () => {
  const r = Days.remaining({ kcal: 500, protein: 50, fat: 20, carbs: 40 }, Days.totals(seeded(), D));
  assert.equal(r.kcal, -120);
  assert.equal(r.over, true);
  assert.equal(r.protein, -5);
});

test('update and remove an item', () => {
  const s = seeded();
  Days.updateItem(s, D, 'breakfast', 1, { kcal: 95 });
  assert.equal(Days.totals(s, D).byMeal.breakfast, 245);
  Days.removeItem(s, D, 'breakfast', 0);
  assert.equal(Days.get(s, D).meals.breakfast.length, 1);
});

test('water never goes below zero', () => {
  const s = State.empty();
  Days.addWater(s, D, 0.25);
  Days.addWater(s, D, -5);
  assert.equal(Days.get(s, D).water, 0);
});

test('coffee can be removed and unknown types are ignored in totals', () => {
  const s = seeded();
  Days.addCoffee(s, D, 'missing');
  assert.equal(Days.totals(s, D).kcal, 620);
  Days.removeCoffee(s, D, 0);
  assert.equal(Days.totals(s, D).kcal, 530);
});

test('steps are stored per day', () => {
  const s = State.empty();
  Days.setSteps(s, D, 6240);
  assert.equal(Days.get(s, D).steps, 6240);
});

test('recent items dedupe by name, newest first, max 20', () => {
  const s = State.empty();
  for (let i = 0; i < 25; i++) Days.pushRecent(s, [item('פריט ' + i, i)]);
  Days.pushRecent(s, [item('פריט 3', 999)]);
  assert.equal(s.recentItems.length, 20);
  assert.equal(s.recentItems[0].name, 'פריט 3');
  assert.equal(s.recentItems[0].kcal, 999);
  assert.equal(s.recentItems.filter(x => x.name === 'פריט 3').length, 1);
});

test('saved meal keeps a copy of the items', () => {
  const s = State.empty();
  const items = [item('חביתה', 180)];
  Days.saveMeal(s, 'בוקר קבוע', items);
  items[0].kcal = 1;
  assert.equal(s.savedMeals.length, 1);
  assert.equal(s.savedMeals[0].name, 'בוקר קבוע');
  assert.equal(s.savedMeals[0].items[0].kcal, 180);
  assert.ok(s.savedMeals[0].id);
});
