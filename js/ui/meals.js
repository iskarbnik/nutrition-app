// מסך ארוחות: ארבע ארוחות, הוספה בצילום / חיפוש / תיאור חופשי, עריכה ומחיקה
(() => {
  const MEAL_NAMES = { breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב', snacks: 'נשנושים' };
  const MEAL_TO = { breakfast: 'לארוחת בוקר', lunch: 'לצהריים', dinner: 'לארוחת ערב', snacks: 'לנשנושים' };
  const AI_ERRORS = {
    'bad-key': 'המפתח של ספק ה-AI לא תקין. אפשר לבדוק אותו בהגדרות.',
    quota: 'נגמרה המכסה של הספק. אפשר לנסות מאוחר יותר או להחליף ספק בהגדרות.',
    offline: 'אין חיבור לאינטרנט. אפשר לחפש ברשימה.',
    timeout: 'הספק לא ענה בזמן. אפשר לנסות שוב או לחפש ברשימה.',
    'ai-failed': 'החישוב נכשל. אפשר לנסות שוב או לחפש ברשימה.',
    'bad-image': 'לא הצלחתי לקרוא את התמונה. אפשר לצלם שוב.',
  };
  const ICONS = {
    photo: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    gallery: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
    text: '<svg viewBox="0 0 24 24"><path d="M5 19h4L19 9l-4-4L5 15z"/><path d="m13 7 4 4"/></svg>',
  };

  let meal = 'breakfast';
  let pendingText = '';

  // ---------- המסך ----------

  function render() {
    const s = Store.get();
    const d = today();
    const tot = Days.totals(s, d);
    const t = currentTargets();
    const stat = (label, value, cls = '') => `<div class="stat ${cls}"><span>${label}</span><b>${value}</b></div>`;
    if (t) {
      const r = Days.remaining(t, tot);
      $('#day-sum').innerHTML =
        stat('נאכלו', fmt(tot.kcal)) +
        stat(r.over ? 'מעל היעד' : 'נותרו', fmt(Math.abs(r.kcal)), r.over ? 'over' : '') +
        stat('גרעון', fmt(t.tdee - tot.kcal));
    } else {
      $('#day-sum').innerHTML = stat('נאכלו', fmt(tot.kcal)) + '<p class="hint">היעדים יחושבו אחרי מילוי הפרטים בהגדרות.</p>';
    }

    const day = s.days[d];
    $('#meal-cards').innerHTML = Days.MEALS.map(m => {
      const items = day ? day.meals[m] : [];
      const rows = items.map((it, i) => `
        <button type="button" class="item-row" data-meal="${m}" data-i="${i}" data-date="${d}">
          <span class="item-name">${esc(it.name)}</span>
          <span class="item-grams">${it.grams ? fmt(it.grams) + ' ג\'' : ''}</span>
          <b>${fmt(it.kcal)}</b>
        </button>`).join('');
      return `
        <div class="card meal-card">
          <div class="meal-head"><h2>${MEAL_NAMES[m]}</h2><span>${fmt(tot.byMeal[m])} קל'</span></div>
          ${rows || '<p class="hint">עוד לא נרשם</p>'}
          <button type="button" class="add-inline" data-add="${m}">+ הוספה</button>
        </div>`;
    }).join('');
  }

  // ---------- שמירה ----------

  function commit(items) {
    if (!items.length) return;
    Store.mutate(s => {
      Days.addItems(s, today(), meal, items);
      Days.pushRecent(s, items);
    });
    UI.sheet.close();
    UI.toast(`נוסף ${MEAL_TO[meal]}`);
    render();
  }

  // ---------- חלונית הוספה ----------

  function mealTabs() {
    return `<div class="seg-tabs" id="add-meal">${Days.MEALS.map(m =>
      `<button type="button" data-m="${m}" class="${m === meal ? 'on' : ''}">${MEAL_NAMES[m]}</button>`).join('')}</div>`;
  }

  function wireMealTabs(root) {
    $$('#add-meal button', root).forEach(b => b.addEventListener('click', () => {
      meal = b.dataset.m;
      $$('#add-meal button', root).forEach(x => x.classList.toggle('on', x === b));
    }));
  }

  function openAdd(forMeal) {
    meal = forMeal || Days.defaultMeal(new Date().getHours());
    const s = Store.get();
    const saved = s.savedMeals.map(sm => `
      <div class="list-row">
        <button type="button" class="list-main" data-saved="${sm.id}">
          <span>${esc(sm.name)}</span><small>${fmt(sm.items.reduce((a, x) => a + x.kcal, 0))} קל'</small>
        </button>
        <button type="button" class="chip-btn del" data-saved-del="${sm.id}"></button>
      </div>`).join('');
    const recent = s.recentItems.slice(0, 8).map((it, i) => `
      <button type="button" class="list-main" data-recent="${i}">
        <span>${esc(it.name)}</span><small>${it.grams ? fmt(it.grams) + ' ג\', ' : ''}${fmt(it.kcal)} קל'</small>
      </button>`).join('');

    const root = UI.sheet.open(`
      <h3 class="sheet-title">מה אכלת?</h3>
      ${mealTabs()}
      <div class="ways">
        <button type="button" class="way" id="w-photo">${ICONS.photo}צילום</button>
        <button type="button" class="way" id="w-gallery">${ICONS.gallery}תמונה מהגלריה</button>
        <button type="button" class="way" id="w-search">${ICONS.search}חיפוש ברשימה</button>
        <button type="button" class="way" id="w-text">${ICONS.text}תיאור חופשי</button>
      </div>
      ${saved ? `<h4 class="sheet-sub">ארוחות שמורות</h4><div class="list">${saved}</div>` : ''}
      ${recent ? `<h4 class="sheet-sub">אחרונים</h4><div class="list">${recent}</div>` : ''}`);

    wireMealTabs(root);
    $('#w-photo', root).addEventListener('click', () => $('#photo-input').click());
    $('#w-gallery', root).addEventListener('click', () => $('#gallery-input').click());
    $('#w-search', root).addEventListener('click', viewSearch);
    $('#w-text', root).addEventListener('click', () => viewText());
    $$('[data-saved]', root).forEach(b => b.addEventListener('click', () => {
      const sm = Store.get().savedMeals.find(x => x.id === b.dataset.saved);
      if (sm) commit(sm.items);
    }));
    $$('[data-saved-del]', root).forEach(b => confirmTap(b, () => {
      Store.mutate(st => { st.savedMeals = st.savedMeals.filter(x => x.id !== b.dataset.savedDel); });
      openAdd(meal);
    }));
    $$('[data-recent]', root).forEach(b => b.addEventListener('click', () => {
      viewPortion(Store.get().recentItems[Number(b.dataset.recent)], false);
    }));
  }

  // ---------- חיפוש ברשימה ----------

  function viewSearch() {
    const root = UI.sheet.open(`
      <h3 class="sheet-title">חיפוש ${MEAL_TO[meal]}</h3>
      <div class="with-mic"><input type="search" id="food-q" placeholder="למשל: חביתה, לחם מלא, תפוח" autocomplete="off">${UI.mic.html()}</div>
      <div class="list" id="food-results"></div>
      <button type="button" class="btn-text back" id="back">חזרה</button>`);
    const q = $('#food-q', root);
    const show = () => {
      const extra = Store.get().recentItems;
      const res = Foods.search(q.value, extra);
      $('#food-results', root).innerHTML = res.map((f, i) => `
        <button type="button" class="list-main" data-r="${i}">
          <span>${esc(f.name)}</span>
          <small>${extra.includes(f) ? `${fmt(f.grams)} ג', ${fmt(f.kcal)} קל'` : `${fmt(f.kcal)} קל' ל-100 ג'`}</small>
        </button>`).join('') || (q.value.trim() ? `<p class="hint">לא נמצא. אפשר לנסות <button type="button" class="btn-link" id="to-text">תיאור חופשי</button>.</p>` : '');
      $$('[data-r]', root).forEach(b => b.addEventListener('click', () => {
        const f = res[Number(b.dataset.r)];
        viewPortion(f, !extra.includes(f));
      }));
      const tt = $('#to-text', root);
      if (tt) tt.addEventListener('click', () => viewText(q.value));
    };
    q.addEventListener('input', show);
    UI.mic.wire(root, q);
    $('#back', root).addEventListener('click', () => openAdd(meal));
    q.focus();
  }

  // כמות: per100 = פריט מהרשימה (ערכים ל-100 גרם). אחרת פריט קיים עם כמות משלו
  function viewPortion(food, per100) {
    const start = per100 ? (food.unit ? food.unit.grams : 100) : food.grams || 100;
    const base = per100 ? Foods.scale(food, 100) : food;
    const unitBtns = per100 && food.unit
      ? [1, 2, 3].map(n => `<button type="button" class="chip-btn" data-g="${n * food.unit.grams}">${n} ${esc(food.unit.name)}</button>`).join('')
      : '';
    const root = UI.sheet.open(`
      <h3 class="sheet-title">${esc(food.name)}</h3>
      ${mealTabs()}
      <label>כמות (גרם)<input type="number" id="grams" inputmode="decimal" min="1" max="3000" value="${start}"></label>
      ${unitBtns ? `<div class="chips">${unitBtns}</div>` : ''}
      <p class="portion-sum" id="portion-sum"></p>
      <button type="button" class="btn primary" id="add-one">הוספה</button>
      <button type="button" class="btn-text back" id="back">חזרה</button>`);
    wireMealTabs(root);
    const grams = $('#grams', root);
    const current = () => Days.scaleItem(base, Number(grams.value) || 0);
    const update = () => {
      const it = current();
      $('#portion-sum', root).textContent = `${fmt(it.kcal)} קלוריות, חלבון ${it.protein} ג', שומן ${it.fat} ג', פחמימות ${it.carbs} ג'`;
    };
    grams.addEventListener('input', update);
    $$('[data-g]', root).forEach(b => b.addEventListener('click', () => { grams.value = b.dataset.g; update(); }));
    $('#add-one', root).addEventListener('click', () => {
      if (!(Number(grams.value) > 0)) return UI.toast('צריך כמות גדולה מ-0');
      commit([current()]);
    });
    $('#back', root).addEventListener('click', viewSearch);
    update();
  }

  // ---------- תיאור חופשי וצילום (AI) ----------

  function viewText(text = pendingText) {
    const root = UI.sheet.open(`
      <h3 class="sheet-title">מה אכלת ${MEAL_TO[meal]}?</h3>
      <div class="with-mic"><textarea id="free-text" rows="3" placeholder="למשל: חביתה משתי ביצים, 2 פרוסות לחם מלא וסלט"></textarea>${UI.mic.html()}</div>
      <button type="button" class="btn primary" id="calc">חישוב</button>
      <button type="button" class="btn-text back" id="back">חזרה</button>`);
    const ta = $('#free-text', root);
    ta.value = text;
    UI.mic.wire(root, ta);
    $('#calc', root).addEventListener('click', () => {
      pendingText = ta.value.trim();
      if (!pendingText) return UI.toast('צריך לכתוב מה אכלת');
      runAI({ text: pendingText });
    });
    $('#back', root).addEventListener('click', () => openAdd(meal));
    ta.focus();
  }

  async function onPhoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    pendingText = '';
    try {
      const img = await AI.resizeImage(file);
      runAI({ imageBase64: img.base64, mediaType: img.mediaType, text: 'מה יש בצלחת? הערך כמויות.' });
    } catch {
      viewError('bad-image');
    }
  }

  async function runAI(input) {
    UI.sheet.open('<div class="loading"><span class="spinner"></span><p>מחשב...</p></div>');
    const provider = Store.get().settings.aiProvider;
    const key = await Secrets.get(Screens.settings.PROVIDERS[provider].key);
    if (!key) return viewError('no-key');
    try {
      const text = await AI.ask(provider, key, { system: AI.mealPrompt, json: true, ...input });
      const { items, error } = AI.parseMeal(text);
      if (!items.length) return viewError('empty', error ? `התשובה: ${text.slice(0, 120)}` : '');
      viewReview(items);
    } catch (err) {
      viewError(err.message, aiErrorDetail(err), aiErrorText(err, ''));
    }
  }

  // detail: פרטי השגיאה מהספק, מוצגים בקטן כדי שאפשר יהיה להבין ולדווח
  function viewError(code, detail = '', text = '') {
    const msg = code === 'no-key'
      ? 'כדי לחשב עם AI צריך להזין מפתח בהגדרות.'
      : code === 'empty'
        ? 'לא זוהה אוכל. אפשר לתאר אחרת או לחפש ברשימה.'
        : text || AI_ERRORS[code] || AI_ERRORS['ai-failed'];
    const toSettings = code === 'no-key' || code === 'bad-key' || code === 'quota';
    const root = UI.sheet.open(`
      <p class="sheet-msg">${msg}</p>
      ${detail ? `<p class="hint err-detail" dir="auto">${esc(detail)}</p>` : ''}
      ${toSettings ? '<button type="button" class="btn primary" id="go-settings">להגדרות</button>' : ''}
      <button type="button" class="btn" id="to-search">חיפוש ברשימה</button>
      ${pendingText ? '<button type="button" class="btn-text back" id="to-text">חזרה לטקסט</button>' : ''}`);
    if (toSettings) $('#go-settings', root).addEventListener('click', () => { UI.sheet.close(); go('settings'); });
    $('#to-search', root).addEventListener('click', viewSearch);
    if (pendingText) $('#to-text', root).addEventListener('click', () => viewText(pendingText));
  }

  // ---------- עורך פריטים (בדיקה אחרי AI, ועריכת פריט קיים) ----------

  const FIELDS = [['kcal', 'קלוריות'], ['protein', 'חלבון'], ['fat', 'שומן'], ['carbs', 'פחמימות']];

  function editorHtml(it, i, removable) {
    return `
      <div class="editor" data-i="${i}">
        <div class="editor-head">
          <input type="text" data-f="name" value="${esc(it.name)}" aria-label="שם">
          ${removable ? `<button type="button" class="chip-btn" data-remove="${i}" aria-label="הסרה">✕</button>` : ''}
        </div>
        <div class="editor-grid">
          <label>גרם<input type="number" inputmode="decimal" data-f="grams" value="${it.grams}"></label>
          ${FIELDS.map(([k, l]) => `<label>${l}<input type="number" inputmode="decimal" data-f="${k}" value="${it[k]}"></label>`).join('')}
        </div>
      </div>`;
  }

  // מחבר את שדות העורך למערך הפריטים. שינוי גרם משנה את כל הערכים באותו יחס
  function wireEditors(root, items, onChange) {
    $$('.editor', root).forEach(ed => {
      const i = Number(ed.dataset.i);
      $$('input', ed).forEach(inp => inp.addEventListener('input', () => {
        const f = inp.dataset.f;
        if (f === 'name') items[i].name = inp.value;
        else if (f === 'grams') {
          const g = Number(inp.value);
          if (g > 0) {
            items[i] = Days.scaleItem(items[i], g);
            for (const [k] of FIELDS) $(`[data-f="${k}"]`, ed).value = items[i][k];
          }
        } else items[i][f] = Math.max(0, Number(inp.value) || 0);
        if (onChange) onChange();
      }));
    });
  }

  function viewReview(items) {
    const root = UI.sheet.open(`
      <h3 class="sheet-title">זה מה שזוהה</h3>
      <p class="hint">אפשר לתקן כל ערך לפני ההוספה.</p>
      ${mealTabs()}
      <div id="editors">${items.map((it, i) => editorHtml(it, i, items.length > 1)).join('')}</div>
      <p class="portion-sum" id="review-sum"></p>
      <button type="button" class="btn primary" id="add-all">הוספה</button>
      <div class="save-meal">
        <input type="text" id="save-name" placeholder="שם לארוחה, למשל: בוקר קבוע">
        <button type="button" class="btn" id="save-meal">שמירה כארוחה קבועה</button>
      </div>
      <button type="button" class="btn-text back" id="back">ביטול</button>`);
    wireMealTabs(root);
    const sum = () => {
      const k = items.reduce((a, x) => a + (Number(x.kcal) || 0), 0);
      $('#review-sum', root).textContent = `סה"כ ${fmt(k)} קלוריות`;
    };
    wireEditors(root, items, sum);
    $$('[data-remove]', root).forEach(b => b.addEventListener('click', () => {
      items.splice(Number(b.dataset.remove), 1);
      viewReview(items);
    }));
    $('#add-all', root).addEventListener('click', () => commit(items.filter(x => x.name.trim())));
    $('#save-meal', root).addEventListener('click', () => {
      const name = $('#save-name', root).value.trim();
      if (!name) return UI.toast('צריך שם לארוחה');
      Store.mutate(s => Days.saveMeal(s, name, items));
      UI.toast('הארוחה נשמרה');
    });
    $('#back', root).addEventListener('click', () => UI.sheet.close());
    sum();
  }

  // date: היום שהוצג במסך, גם אם בינתיים עבר חצות
  function viewEdit(m, index, date) {
    const day = Store.get().days[date];
    const original = day && day.meals[m][index];
    if (!original) return render();
    const items = [{ ...original }];
    const root = UI.sheet.open(`
      <h3 class="sheet-title">עריכה</h3>
      <div id="editors">${editorHtml(items[0], 0, false)}</div>
      <button type="button" class="btn primary" id="save">שמירה</button>
      <button type="button" class="btn del-wide" id="del"></button>`);
    wireEditors(root, items);
    $('#save', root).addEventListener('click', () => {
      Store.mutate(s => Days.updateItem(s, date, m, index, items[0]));
      UI.sheet.close();
      render();
    });
    confirmTap($('#del', root), () => {
      Store.mutate(s => Days.removeItem(s, date, m, index));
      UI.sheet.close();
      render();
    });
  }

  function init() {
    $('#fab-add').addEventListener('click', () => openAdd());
    $('#photo-input').addEventListener('change', onPhoto);
    $('#gallery-input').addEventListener('change', onPhoto);
    $('#meal-cards').addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) return openAdd(add.dataset.add);
      const row = e.target.closest('.item-row');
      if (row) viewEdit(row.dataset.meal, Number(row.dataset.i), row.dataset.date);
    });
  }

  Screens.meals = { init, render };
})();
