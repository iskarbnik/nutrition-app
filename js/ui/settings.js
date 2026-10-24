// מסך הגדרות: פרטים אישיים, יעדים, ספק AI ומפתח
(() => {
  const NUM_FIELDS = ['birthYear', 'height', 'activity', 'goalWeight', 'goalFat'];
  const MACROS = ['kcal', 'protein', 'fat', 'carbs'];
  const PROVIDERS = {
    gemini: {
      key: 'geminiKey',
      note: 'ל-Gemini יש שכבה חינמית. בשכבה החינמית, Google עשויה להשתמש בנתונים לשיפור המוצרים.',
      link: 'https://aistudio.google.com/apikey',
      linkText: 'יצירת מפתח ב-Google AI Studio',
    },
    claude: {
      key: 'claudeKey',
      note: 'Claude בתשלום לפי שימוש, בערך אגורות לתמונה.',
      link: 'https://console.anthropic.com/settings/keys',
      linkText: 'יצירת מפתח ב-Anthropic Console',
    },
  };

  // פרטים אישיים
  function fillProfile() {
    const form = $('#profile-form').elements;
    const p = Store.get().profile;
    form.name.value = p.name || '';
    for (const f of NUM_FIELDS) form[f].value = p[f] ?? '';
    form.activity.value = String(p.activity);
    form.sex.value = p.sex || '';
  }

  function readProfile() {
    const form = $('#profile-form').elements;
    const patch = { name: form.name.value.trim() };
    for (const f of NUM_FIELDS) {
      const v = form[f].value.trim();
      patch[f] = v === '' ? null : Number(v);
    }
    patch.sex = form.sex.value || null;
    return patch;
  }

  function validateProfile(p) {
    const year = new Date().getFullYear();
    if (p.birthYear && (p.birthYear < 1920 || p.birthYear > year - 10)) return 'שנת לידה לא תקינה';
    if (p.height && (p.height < 120 || p.height > 230)) return 'גובה צריך להיות בין 120 ל-230 ס"מ';
    if (p.goalWeight && (p.goalWeight < 35 || p.goalWeight > 250)) return 'משקל יעד לא תקין';
    if (p.goalFat && (p.goalFat < 3 || p.goalFat > 60)) return 'אחוז שומן יעד לא תקין';
    return null;
  }

  function onProfileSubmit(e) {
    e.preventDefault();
    const status = $('#profile-status');
    const patch = readProfile();
    const err = validateProfile(patch);
    if (err) return showStatus(status, err, false);
    Store.updateProfile(patch);
    showStatus(status, 'נשמר ✓', true);
    fillTargets();
  }

  // יעדים: השדות מכילים רק דריסות. הערך האוטומטי מוצג כמציין מקום
  function fillTargets() {
    const form = $('#targets-form').elements;
    const s = Store.get();
    const o = s.profile.overrides || {};
    const auto = Targets.compute({ ...s.profile, overrides: {} }, State.latestMeasurement(s), today());
    for (const k of MACROS) {
      form[k].value = o[k] ?? '';
      form[k].placeholder = auto ? fmt(auto[k]) : '';
    }
    $('#targets-auto').textContent = auto
      ? `מחושב אוטומטית: ${fmt(auto.kcal)} קלוריות, חלבון ${auto.protein} ג', שומן ${auto.fat} ג', פחמימות ${auto.carbs} ג'.`
        + (auto.floored ? ' היעד הועלה לרצפה הבטוחה.' : '')
      : 'כדי לחשב יעדים צריך שנת לידה, מין, גובה ומשקל אחד לפחות.';
  }

  function onTargetsSubmit(e) {
    e.preventDefault();
    const form = $('#targets-form').elements;
    const overrides = {};
    for (const k of MACROS) {
      const v = form[k].value.trim();
      if (v === '') continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < Number(form[k].min) || n > Number(form[k].max)) {
        return showStatus($('#targets-status'), 'אחד הערכים מחוץ לטווח הסביר', false);
      }
      overrides[k] = n;
    }
    Store.updateProfile({ overrides });
    showStatus($('#targets-status'), 'נשמר ✓', true);
  }

  // ספק AI ומפתח
  async function fillAI() {
    const provider = Store.get().settings.aiProvider;
    $$('input[name="aiProvider"]').forEach(r => { r.checked = r.value === provider; });
    const info = PROVIDERS[provider];
    $('#ai-note').textContent = info.note;
    $('#ai-key-link').href = info.link;
    $('#ai-key-link').textContent = info.linkText;
    $('#ai-key').value = '';
    const saved = !!(await Secrets.get(info.key));
    $('#ai-key-saved').hidden = !saved;
    $('#ai-key').placeholder = saved ? 'להחלפה, הדביקו מפתח חדש' : 'הדביקו כאן את המפתח';
  }

  async function onKeySave() {
    const value = AI.cleanKey($('#ai-key').value);
    const status = $('#ai-status');
    if (value.length < 20) return showStatus(status, 'המפתח נראה קצר מדי. כדאי להעתיק אותו שוב.', false);
    await Secrets.set(PROVIDERS[Store.get().settings.aiProvider].key, value);
    showStatus(status, 'המפתח נשמר ✓', true);
    fillAI();
  }

  async function onKeyClear() {
    await Secrets.clear(PROVIDERS[Store.get().settings.aiProvider].key);
    showStatus($('#ai-status'), 'המפתח נמחק', true);
    fillAI();
  }

  // מים וסוגי קפה
  const COFFEE_FIELDS = ['kcal', 'protein', 'fat', 'carbs'];

  function fillDrinks() {
    const s = Store.get();
    $('#water-goal-input').value = s.profile.waterGoal;
    $('#coffee-types').innerHTML = s.coffeeTypes.map(c => `
      <div class="list-row">
        <div class="list-main"><span>${esc(c.name)}</span><small>${fmt(c.kcal)} קל'</small></div>
        <button type="button" class="chip-btn del" data-coffee-del="${c.id}"></button>
      </div>`).join('') || '<p class="hint">עוד אין סוגי קפה.</p>';
    $$('[data-coffee-del]').forEach(b => confirmTap(b, () => {
      Store.mutate(st => { st.coffeeTypes = st.coffeeTypes.filter(c => c.id !== b.dataset.coffeeDel); });
      fillDrinks();
    }));
  }

  function onCoffeeSubmit(e) {
    e.preventDefault();
    const form = $('#coffee-form').elements;
    const name = form.name.value.trim();
    if (!name) return showStatus($('#coffee-status'), 'צריך שם לסוג הקפה', false);
    const type = { id: 'c' + Date.now().toString(36), name, fiber: 0, sugar: 0, sodium: 0 };
    for (const k of COFFEE_FIELDS) type[k] = Math.max(0, Number(form[k].value) || 0);
    Store.mutate(s => { s.coffeeTypes.push(type); });
    $('#coffee-form').reset();
    showStatus($('#coffee-status'), 'נוסף ✓', true);
    fillDrinks();
  }

  async function onCoffeeAI() {
    const form = $('#coffee-form').elements;
    const status = $('#coffee-status');
    const name = form.name.value.trim();
    if (!name) return showStatus(status, 'צריך קודם לכתוב שם, למשל: הפוך גדול עם חלב 1%', false);
    const provider = Store.get().settings.aiProvider;
    const key = await Secrets.get(PROVIDERS[provider].key);
    if (!key) return showStatus(status, 'צריך להזין מפתח AI למטה', false);
    // הודעת ההמתנה נשארת עד שמגיעה תשובה
    status.textContent = 'מחשב...';
    status.className = 'status ok';
    clearTimeout(status._t);
    const btn = $('#coffee-ai');
    btn.disabled = true;
    try {
      const { items } = AI.parseMeal(await AI.ask(provider, key, { system: AI.mealPrompt, json: true, text: `כוס אחת: ${name}` }));
      if (!items.length) return showStatus(status, 'לא הצלחתי לחשב. אפשר למלא ידנית.', false);
      for (const k of COFFEE_FIELDS) form[k].value = Math.round(items.reduce((a, x) => a + x[k], 0) * 10) / 10;
      showStatus(status, 'אפשר לבדוק ולהוסיף', true);
    } catch (err) {
      const msg = {
        offline: 'אין חיבור לאינטרנט',
        'bad-key': 'המפתח של ספק ה-AI לא תקין',
        quota: 'נגמרה המכסה של הספק. אפשר לנסות מאוחר יותר.',
        timeout: 'הספק לא ענה בזמן. אפשר לנסות שוב.',
      }[err.message] || 'החישוב נכשל. אפשר למלא ידנית.';
      const detail = err.status ? `${err.status}: ${err.detail}` : !['ai-failed', 'timeout', 'offline', 'bad-key', 'quota'].includes(err.message) && err.message;
      showStatus(status, detail ? `${msg} (${detail})` : msg, false);
    } finally {
      btn.disabled = false;
    }
  }

  function render() {
    fillProfile();
    fillTargets();
    fillDrinks();
    fillAI();
    if (Screens.cloud) Screens.cloud.render();
    if (Screens.reminders) Screens.reminders.render();
  }

  function init() {
    $('#profile-form').addEventListener('submit', onProfileSubmit);
    $('#targets-form').addEventListener('submit', onTargetsSubmit);
    $$('input[name="aiProvider"]').forEach(r => r.addEventListener('change', () => {
      Store.mutate(s => { s.settings.aiProvider = r.value; });
      fillAI();
    }));
    $('#water-goal-input').addEventListener('change', e => {
      const v = Number(e.target.value);
      if (v >= 0.5 && v <= 6) Store.updateProfile({ waterGoal: v });
    });
    $('#coffee-form').addEventListener('submit', onCoffeeSubmit);
    $('#coffee-ai').addEventListener('click', onCoffeeAI);
    $('#ai-key-save').addEventListener('click', onKeySave);
    $('#ai-key-clear').addEventListener('click', onKeyClear);
  }

  Screens.settings = { init, render, PROVIDERS };
})();
