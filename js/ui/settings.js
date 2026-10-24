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
    const value = $('#ai-key').value.trim();
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

  function render() {
    fillProfile();
    fillTargets();
    fillAI();
  }

  function init() {
    $('#profile-form').addEventListener('submit', onProfileSubmit);
    $('#targets-form').addEventListener('submit', onTargetsSubmit);
    $$('input[name="aiProvider"]').forEach(r => r.addEventListener('change', () => {
      Store.mutate(s => { s.settings.aiProvider = r.value; });
      fillAI();
    }));
    $('#ai-key-save').addEventListener('click', onKeySave);
    $('#ai-key-clear').addEventListener('click', onKeyClear);
  }

  Screens.settings = { init, render, PROVIDERS };
})();
