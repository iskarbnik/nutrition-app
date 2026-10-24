const test = require('node:test');
const assert = require('node:assert/strict');
const Foods = require('../js/foods.js');

test('list has enough foods with all nutrients', () => {
  assert.ok(Foods.list.length >= 140);
  for (const f of Foods.list) {
    for (const k of ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium']) {
      assert.equal(typeof f[k], 'number', `${f.name}.${k}`);
    }
  }
});

test('search finds omelette', () => {
  assert.ok(Foods.search('חביתה').some(f => f.name.includes('חביתה')));
});

test('search ignores niqqud in the query', () => {
  assert.ok(Foods.search('בָּנָנָה').some(f => f.name === 'בננה'));
});

test('every word must match, prefix matches come first', () => {
  const r = Foods.search('לחם מלא');
  assert.ok(r.length > 0);
  assert.ok(r.every(f => f.name.includes('לחם') && f.name.includes('מלא')));
  const t = Foods.search('תפוח');
  assert.ok(t[0].name.startsWith('תפוח'));
});

test('empty query returns nothing', () => {
  assert.deepEqual(Foods.search(''), []);
  assert.deepEqual(Foods.search('   '), []);
});

test('extra items (recent, saved) come before the list without duplicates', () => {
  const mine = { name: 'בננה', kcal: 100, protein: 1, fat: 0, carbs: 25, fiber: 3, sugar: 14, sodium: 1, grams: 120 };
  const r = Foods.search('בננה', [mine]);
  assert.equal(r[0], mine);
  assert.equal(r.filter(f => f.name === 'בננה').length, 1);
});

test('search returns at most 20 results', () => {
  assert.ok(Foods.search('ה').length <= 20);
});

test('scale converts per-100g values to a portion item', () => {
  const it = Foods.scale({ name: 'ביצה', kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1, fiber: 0, sugar: 1.1, sodium: 124 }, 50);
  assert.equal(it.kcal, 77.5);
  assert.equal(it.protein, 6.3);
  assert.equal(it.grams, 50);
  assert.equal(it.source, 'list');
  assert.equal(it.name, 'ביצה');
});
