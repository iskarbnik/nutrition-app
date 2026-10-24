process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert/strict');
const Reminders = require('../js/reminders.js');

const settings = {
  weigh: { on: true, time: '07:30' },
  water: { on: true, every: 2 },
  meals: { on: true, times: ['09:00', '13:30', '19:30'] },
};
const at = hhmm => new Date(`2026-10-24T${hhmm}:00+03:00`);
const ctx = (over = {}) => ({
  weighedToday: false, water: 0.5, waterGoal: 2.5,
  mealsLogged: { breakfast: true, lunch: true, dinner: true, snacks: false }, ...over,
});
const keys = list => list.map(r => r.key);

test('weigh reminder after its time when not weighed', () => {
  assert.ok(keys(Reminders.due(settings, {}, at('08:00'), ctx())).includes('weigh'));
  assert.ok(!keys(Reminders.due(settings, {}, at('07:00'), ctx())).includes('weigh'));
});

test('no weigh reminder once weighed today', () => {
  assert.ok(!keys(Reminders.due(settings, {}, at('08:00'), ctx({ weighedToday: true }))).includes('weigh'));
});

test('weigh reminder shows once a day', () => {
  const shown = { weigh: at('07:45').toISOString() };
  assert.ok(!keys(Reminders.due(settings, shown, at('12:00'), ctx())).includes('weigh'));
});

test('water reminder every N hours during the day, below goal', () => {
  assert.ok(keys(Reminders.due(settings, { water: at('07:00').toISOString() }, at('10:00'), ctx())).includes('water'));
  assert.ok(!keys(Reminders.due(settings, { water: at('09:30').toISOString() }, at('10:00'), ctx())).includes('water'));
});

test('no water reminder at night or when goal reached', () => {
  assert.ok(!keys(Reminders.due(settings, {}, at('23:00'), ctx())).includes('water'));
  assert.ok(!keys(Reminders.due(settings, {}, at('06:30'), ctx())).includes('water'));
  assert.ok(!keys(Reminders.due(settings, {}, at('12:00'), ctx({ water: 2.5 }))).includes('water'));
});

test('meal reminder an hour after meal time when that meal is empty', () => {
  const c = ctx({ mealsLogged: { breakfast: false, lunch: false, dinner: false, snacks: false } });
  assert.deepEqual(keys(Reminders.due({ ...settings, weigh: { on: false }, water: { on: false } }, {}, at('10:15'), c)), ['meal-breakfast']);
  assert.ok(!keys(Reminders.due(settings, {}, at('09:30'), c)).includes('meal-breakfast'));
});

test('meal reminder is not repeated the same day', () => {
  const c = ctx({ mealsLogged: { breakfast: false, lunch: true, dinner: true, snacks: false } });
  const shown = { 'meal-breakfast': at('10:05').toISOString() };
  assert.ok(!keys(Reminders.due(settings, shown, at('11:00'), c)).includes('meal-breakfast'));
});

test('switched off reminders never fire', () => {
  const off = { weigh: { on: false, time: '07:30' }, water: { on: false, every: 2 }, meals: { on: false, times: ['09:00', '13:30', '19:30'] } };
  const c = ctx({ mealsLogged: { breakfast: false, lunch: false, dinner: false } });
  assert.deepEqual(Reminders.due(off, {}, at('20:45'), c), []);
});
