// AI: זיהוי אוכל מטקסט ומתמונה, וטיפ שבועי. שני ספקים: Gemini ו-Claude
(function (root) {
  const Config = typeof require === 'function' ? require('./config.js') : root.Config;

  const mealPrompt = [
    'You estimate nutrition for food eaten in Israel. The user writes in Hebrew or sends a photo.',
    'Use typical Israeli portions when no amount is given.',
    'Reply ONLY with JSON, no other text, in this exact shape:',
    '{"items":[{"name":"<Hebrew name>","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"sugar":0,"sodium":0}]}',
    'grams, protein, fat, carbs, fiber, sugar in grams; sodium in milligrams; kcal for the whole portion.',
    'If you cannot identify any food, reply {"items":[]}.',
  ].join('\n');

  // sexWord: 'male' | 'female' | null, לפנייה בלשון הנכונה
  function tipPrompt(stats, sexWord) {
    const address = sexWord === 'male' ? 'masculine' : sexWord === 'female' ? 'feminine' : 'gender-neutral';
    return [
      'You are a kind, practical nutrition coach. Write ONE short tip in Hebrew (max 2 sentences, under 300 characters),',
      `addressing the user in ${address} Hebrew. No medical claims, no judgment.`,
      'Base it on this week summary (JSON):',
      JSON.stringify(stats),
    ].join('\n');
  }

  const adapters = {
    gemini: {
      build(model, input, apiKey) {
        const parts = [];
        if (input.text) parts.push({ text: input.text });
        if (input.imageBase64) parts.push({ inline_data: { mime_type: input.mediaType || 'image/jpeg', data: input.imageBase64 } });
        const body = { contents: [{ role: 'user', parts }] };
        if (input.system) body.systemInstruction = { parts: [{ text: input.system }] };
        if (input.json) body.generationConfig = { responseMimeType: 'application/json' };
        return {
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
        };
      },
      extract: json => json.candidates[0].content.parts.map(p => p.text || '').join(''),
    },
    claude: {
      build(model, input, apiKey) {
        const content = [];
        if (input.imageBase64) {
          content.push({ type: 'image', source: { type: 'base64', media_type: input.mediaType || 'image/jpeg', data: input.imageBase64 } });
        }
        content.push({ type: 'text', text: input.text || 'מה יש בתמונה?' });
        const body = { model, max_tokens: 1024, messages: [{ role: 'user', content }] };
        if (input.system) body.system = input.system;
        return {
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body,
        };
      },
      extract: json => json.content.filter(c => c.type === 'text').map(c => c.text).join(''),
    },
  };

  async function ask(provider, apiKey, input, fetchImpl) {
    const doFetch = fetchImpl || ((...a) => fetch(...a));
    const adapter = adapters[provider];
    const req = adapter.build(Config.AI_MODELS[provider], input, apiKey);
    let res;
    try {
      res = await doFetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
    } catch {
      throw new Error('offline');
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('bad-key');
      if (res.status === 429) throw new Error('quota');
      if (res.status === 400) {
        const text = await res.text().catch(() => '');
        if (/api key/i.test(text)) throw new Error('bad-key');
      }
      throw new Error('ai-failed');
    }
    try {
      return adapter.extract(await res.json());
    } catch {
      throw new Error('ai-failed');
    }
  }

  const NUMS = ['grams', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium'];

  // מנסה למצוא JSON בתוך טקסט: מכל "{" או "[" ועד הסוגר האחרון המתאים
  function findJson(s) {
    for (let i = 0; i < s.length; i++) {
      const open = s[i];
      if (open !== '{' && open !== '[') continue;
      const end = s.lastIndexOf(open === '{' ? '}' : ']');
      if (end <= i) continue;
      try { return JSON.parse(s.slice(i, end + 1)); } catch { /* ננסה מהסוגר הבא */ }
    }
    return undefined;
  }

  // "1,200" → 1200
  const num = v => Number(String(v ?? '').replace(/,/g, '').trim());

  function parseMeal(text) {
    const data = findJson(String(text || ''));
    if (data === undefined) return { items: [], error: 'no-json' };
    const raw = Array.isArray(data) ? data : Array.isArray(data && data.items) ? data.items : [];
    const items = [];
    for (const r of raw) {
      if (!r || typeof r.name !== 'string' || !r.name.trim()) continue;
      const kcal = num(r.kcal);
      if (!Number.isFinite(kcal) || kcal < 0) continue;
      const it = { name: r.name.trim(), source: 'ai' };
      for (const k of NUMS) {
        const v = num(r[k]);
        it[k] = Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0;
      }
      items.push(it);
    }
    return { items };
  }

  const parseTip = text => String(text || '').trim().slice(0, 300);

  // מקטין תמונה לפני שליחה (דפדפן בלבד)
  function resizeImage(file, maxSide = 1024) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(img.src);
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mediaType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('bad-image'));
      img.src = URL.createObjectURL(file);
    });
  }

  const AI = { mealPrompt, tipPrompt, adapters, ask, parseMeal, parseTip, resizeImage };
  if (typeof module !== 'undefined') module.exports = AI;
  else root.AI = AI;
})(this);
