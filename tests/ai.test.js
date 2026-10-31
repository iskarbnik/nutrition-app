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

test('cleanKey strips invisible direction marks, spaces and pasted labels', () => {
  assert.equal(AI.cleanKey('‏AIza-Key_123‎ '), 'AIza-Key_123');
  assert.equal(AI.cleanKey('מפתח: AIzaKey'), 'AIzaKey');
  assert.equal(AI.cleanKey('sk-ant-api03-AbC\n'), 'sk-ant-api03-AbC');
});

test('ask sends a clean key even if a dirty one was saved', async () => {
  let sent;
  const spy = async (url, opts) => { sent = opts.headers; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }) }; };
  await AI.ask('gemini', '‏AIzaGoodKey‎', input, spy);
  assert.equal(sent['x-goog-api-key'], 'AIzaGoodKey');
});

test('a key that is empty after cleaning is bad-key, not offline', async () => {
  await assert.rejects(AI.ask('gemini', '‏‎', input, fakeFetch(200, {})), { message: 'bad-key' });
});

test('failed calls carry the HTTP status and the provider message for display', async () => {
  const body = { error: { code: 404, message: 'models/gemini-x is not found for API version v1beta', status: 'NOT_FOUND' } };
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(404, body)), err => {
    assert.equal(err.message, 'ai-failed');
    assert.equal(err.status, 404);
    assert.match(err.detail, /not found/);
    return true;
  });
});

test('a request with no answer stops after the timeout with timeout', async () => {
  const hang = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  await assert.rejects(AI.ask('gemini', 'k', { text: 'x' }, hang, 30), { message: 'timeout' });
});

test('gemini requests always cap output and lower thinking', () => {
  for (const inp of [{ text: 'x' }, { text: 'x', json: true }]) {
    const g = AI.adapters.gemini.build('gemini-x', inp, 'k').body.generationConfig;
    assert.ok(g.maxOutputTokens > 0 && g.maxOutputTokens <= 8192);
    assert.equal(g.thinkingConfig.thinkingLevel, 'LOW');
  }
});

test('a response body that stalls also stops at the timeout', async () => {
  const stall = async (url, opts) => ({
    ok: true, status: 200,
    json: () => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }),
  });
  await assert.rejects(AI.ask('gemini', 'k', { text: 'x' }, stall, 30), { message: 'timeout' });
});

test('an answer cut off at the output cap is too-long, not a parse failure', async () => {
  const g = { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"items":[' }] } }] };
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(200, g)), { message: 'too-long' });
  const noParts = { candidates: [{ finishReason: 'MAX_TOKENS', content: {} }] };
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(200, noParts)), { message: 'too-long' });
  const c = { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"items":[' }] };
  await assert.rejects(AI.ask('claude', 'k', input, fakeFetch(200, c)), { message: 'too-long' });
});

test('every call reports timing and tokens, never the key or the content', async () => {
  const seen = [];
  AI.onCall = e => seen.push(e);
  try {
    const ok = {
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'SECRET-ANSWER' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 60 },
    };
    await AI.ask('gemini', 'SECRET-KEY', { text: 'SECRET-TEXT' }, fakeFetch(200, ok));
    await assert.rejects(AI.ask('gemini', 'SECRET-KEY', { text: 'x' }, fakeFetch(429, {})));
  } finally {
    AI.onCall = null;
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0].provider, 'gemini');
  assert.equal(seen[0].status, 200);
  assert.equal(seen[0].finish, 'STOP');
  assert.equal(seen[0].thoughts, 30);
  assert.equal(seen[0].total, 60);
  assert.equal(seen[0].code, 'ok');
  assert.ok(seen[0].ms >= 0);
  assert.equal(seen[1].code, 'quota');
  const all = JSON.stringify(seen);
  assert.ok(!all.includes('SECRET'));
});

test('a logging hook that throws does not break the call', async () => {
  AI.onCall = () => { throw new Error('boom'); };
  try {
    const r = await AI.ask('gemini', 'k', input, fakeFetch(200, { candidates: [{ content: { parts: [{ text: 'G' }] } }] }));
    assert.equal(r, 'G');
  } finally {
    AI.onCall = null;
  }
});

test('quota errors say whether the limit is per day or per minute', async () => {
  const body = (quotaId, retryDelay) => ({ error: { message: 'over', details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
  ] } });
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(429, body('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '50s'))),
    e => e.message === 'quota' && e.quotaKind === 'day');
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(429, body('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '34s'))),
    e => e.message === 'quota' && e.quotaKind === 'minute' && e.retrySec === 34);
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(429, {})), e => e.message === 'quota' && !e.quotaKind);
});

test('addLog keeps the newest ten entries first', () => {
  let log = [];
  for (let i = 0; i < 12; i++) log = AI.addLog(log, { n: i });
  assert.equal(log.length, 10);
  assert.equal(log[0].n, 11);
  assert.equal(log[9].n, 2);
});

test('an overloaded provider is busy, for each provider', async () => {
  await assert.rejects(AI.ask('gemini', 'k', input, fakeFetch(503, { error: { message: 'high demand' } })), { message: 'busy' });
  await assert.rejects(AI.ask('claude', 'k', input, fakeFetch(529, { error: { message: 'overloaded' } })), { message: 'busy' });
});
