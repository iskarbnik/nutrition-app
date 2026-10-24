const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../js/ai.js');

test('parseMeal pulls JSON out of surrounding text and coerces numbers', () => {
  const r = AI.parseMeal('הנה: {"items":[{"name":"חביתה","grams":"120","kcal":"180"}]} בתיאבון');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].grams, 120);
  assert.equal(r.items[0].kcal, 180);
  assert.equal(r.items[0].protein, 0);
  assert.equal(r.items[0].source, 'ai');
  assert.equal(r.error, undefined);
});

test('parseMeal drops items without a name or with bad calories', () => {
  const r = AI.parseMeal(JSON.stringify({ items: [
    { name: 'לחם', grams: 30, kcal: 75 },
    { name: 'משהו', kcal: -3 },
    { name: '', kcal: 50 },
    { name: 'לא מספר', kcal: 'הרבה' },
  ] }));
  assert.deepEqual(r.items.map(i => i.name), ['לחם']);
});

test('parseMeal on garbage returns no items and an error', () => {
  const r = AI.parseMeal('סליחה, לא הצלחתי לזהות');
  assert.deepEqual(r.items, []);
  assert.ok(r.error);
});

test('parseTip trims and caps length', () => {
  assert.equal(AI.parseTip('  טיפ קצר  '), 'טיפ קצר');
  assert.ok(AI.parseTip('א'.repeat(500)).length <= 300);
});

const input = { system: 'sys', text: 'חביתה', imageBase64: 'AAAA', mediaType: 'image/jpeg', json: true };

test('gemini request keeps the key out of the URL and sends the image inline', () => {
  const r = AI.adapters.gemini.build('gemini-x', input, 'SECRET');
  assert.ok(!r.url.includes('SECRET'));
  assert.ok(!r.url.includes('key='));
  assert.equal(r.headers['x-goog-api-key'], 'SECRET');
  assert.ok(r.url.includes('/models/gemini-x:generateContent'));
  const parts = r.body.contents[0].parts;
  assert.ok(parts.some(p => p.inline_data && p.inline_data.data === 'AAAA' && p.inline_data.mime_type === 'image/jpeg'));
  assert.equal(r.body.generationConfig.responseMimeType, 'application/json');
});

test('claude request has the browser-access header and a base64 image block', () => {
  const r = AI.adapters.claude.build('claude-x', input, 'SECRET');
  assert.equal(r.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(r.headers['x-api-key'], 'SECRET');
  const content = r.body.messages[0].content;
  assert.ok(content.some(c => c.type === 'image' && c.source.type === 'base64' && c.source.data === 'AAAA'));
  assert.equal(r.body.system, 'sys');
});

const fakeFetch = (status, json) => async () => ({
  ok: status >= 200 && status < 300, status,
  json: async () => json, text: async () => JSON.stringify(json),
});

test('ask maps HTTP errors to friendly codes', async () => {
  for (const provider of ['gemini', 'claude']) {
    await assert.rejects(AI.ask(provider, 'k', input, fakeFetch(401, {})), { message: 'bad-key' });
    await assert.rejects(AI.ask(provider, 'k', input, fakeFetch(429, {})), { message: 'quota' });
    await assert.rejects(AI.ask(provider, 'k', input, fakeFetch(500, {})), { message: 'ai-failed' });
    await assert.rejects(AI.ask(provider, 'k', input, async () => { throw new TypeError('Failed to fetch'); }), { message: 'offline' });
  }
});

test('gemini invalid key comes back as 400 and is still bad-key', async () => {
  const body = { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } };
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(400, body)), { message: 'bad-key' });
});

test('ask returns the model text for each provider', async () => {
  const g = await AI.ask('gemini', 'k', input, fakeFetch(200, { candidates: [{ content: { parts: [{ text: 'G' }] } }] }));
  const c = await AI.ask('claude', 'k', input, fakeFetch(200, { content: [{ type: 'text', text: 'C' }] }));
  assert.equal(g, 'G');
  assert.equal(c, 'C');
});

test('parseMeal accepts a bare array of items', () => {
  const r = AI.parseMeal('[{"name":"תפוח","grams":180,"kcal":94}]');
  assert.deepEqual(r.items.map(i => i.name), ['תפוח']);
});

test('parseMeal finds the JSON even after a stray brace in the prose', () => {
  const r = AI.parseMeal('הערכה {בערך}: {"items":[{"name":"לחם","grams":30,"kcal":75}]}');
  assert.deepEqual(r.items.map(i => i.name), ['לחם']);
});

test('parseMeal strips thousands separators', () => {
  const r = AI.parseMeal('{"items":[{"name":"פיצה","grams":"450","kcal":"1,200"}]}');
  assert.equal(r.items[0].kcal, 1200);
});
