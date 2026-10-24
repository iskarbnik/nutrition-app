const TITLES = {
  home: 'ראשי',
  meals: 'ארוחות',
  body: 'מדדים',
  activity: 'פעילות',
  settings: 'הגדרות',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// טקסט לפי המין בהגדרות. בלי מין: ניסוח ניטרלי
function g(male, female, neutral) {
  const sex = Store.get().profile.sex;
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return neutral;
}

// ניווט בין מסכים
function go(screen) {
  $$('.screen').forEach(s => { s.hidden = s.dataset.screen !== screen; });
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.go === screen));
  $('#screen-title').textContent = TITLES[screen];
  if (screen === 'home') renderHome();
  if (screen === 'body') resetMeasureForm();
  if (screen === 'settings') fillProfileForm();
  window.scrollTo(0, 0);
}

function showStatus(el, text, ok) {
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'err');
  clearTimeout(el._t);
  if (ok) el._t = setTimeout(() => { el.textContent = ''; }, 2500);
}

// תאריך מקומי בפורמט YYYY-MM-DD
function today() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

// מסך ראשי (זמני עד שלב 6)
function renderHome() {
  const p = Store.get().profile;
  $('#home-hello').textContent = p.name ? `שלום ${p.name}` : 'שלום';
  const missing = !p.height || !p.birthYear || !p.goalWeight || !p.sex;
  $('#home-msg').textContent = missing
    ? g('כדי להתחיל, מלא פרטים במסך הגדרות.', 'כדי להתחיל, מלאי פרטים במסך הגדרות.', 'כדי להתחיל, צריך למלא פרטים במסך הגדרות.')
    : 'הפרטים נשמרו. אפשר להזין מדידות במסך מדדים.';
}

// טופס פרטים אישיים
const NUM_FIELDS = ['birthYear', 'height', 'activity', 'goalWeight', 'goalFat'];

function fillProfileForm() {
  const form = $('#profile-form').elements;
  const p = Store.get().profile;
  form.name.value = p.name || '';
  for (const f of NUM_FIELDS) form[f].value = p[f] ?? '';
  form.activity.value = String(p.activity);
  form.sex.value = p.sex || '';
}

function readProfileForm() {
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
  const patch = readProfileForm();
  const err = validateProfile(patch);
  if (err) {
    status.textContent = err;
    status.className = 'status err';
    return;
  }
  const ok = Store.updateProfile(patch);
  showStatus(status, ok ? 'נשמר ✓' : 'השמירה נכשלה', ok);
}

// מדדים
const MEASURE_FIELDS = [
  { key: 'weight', label: 'משקל', unit: 'ק"ג', min: 30, max: 300 },
  { key: 'fat', label: 'שומן', unit: '%', min: 3, max: 70 },
  { key: 'waist', label: 'מותניים', unit: 'ס"מ', min: 40, max: 200 },
  { key: 'height', label: 'גובה', unit: 'ס"מ', min: 120, max: 230 },
];

// ממלא את הטופס בערכים של התאריך שנבחר, אם יש
function fillMeasureForm(date) {
  const form = $('#measure-form').elements;
  const m = Store.measurementOn(date);
  form.date.value = date;
  for (const f of MEASURE_FIELDS) form[f.key].value = m && m[f.key] != null ? m[f.key] : '';
  form.cycle.checked = !!(m && m.cycle);
  $('#cycle-row').hidden = Store.get().profile.sex === 'male';
  $('#measure-form h2').textContent = m ? `עריכת מדידה ${formatDate(date)}` : 'מדידה חדשה';
}

function resetMeasureForm() {
  const form = $('#measure-form').elements;
  form.date.max = today();
  fillMeasureForm(today());
  $('#measure-status').textContent = '';
  renderMeasureList();
  renderChart();
}

// גרף
let chartMetric = 'weight';
let chartRange = '90';

function renderChart() {
  const p = Store.get().profile;
  const all = Store.get().measurements;
  const f = MEASURE_FIELDS.find(x => x.key === chartMetric);
  const data = all.filter(m => m[f.key] != null).map(m => ({ date: m.date, value: m[f.key] }));
  const goal = chartMetric === 'weight' ? p.goalWeight : chartMetric === 'fat' ? p.goalFat : null;
  const showAvg = chartMetric === 'weight';
  const cycleDates = showAvg ? all.filter(m => m.cycle).map(m => m.date) : [];
  const fromDay = chartRange === 'all' ? null : Charts.toDay(today()) - Number(chartRange);

  Charts.line($('#chart'), { data, goal, unit: f.unit, showAvg, cycleDates, fromDay });

  const legend = [];
  if (showAvg) legend.push('<span><i class="raw"></i>מדידה</span>', '<span><i></i>ממוצע 7 ימים</span>');
  if (goal != null) legend.push('<span><i class="goal"></i>יעד</span>');
  if (cycleDates.length) legend.push('<span><i class="cycle"></i>מחזור</span>');
  $('#chart-legend').innerHTML = legend.join('');

  renderTrend(data, goal, f);
}

function renderTrend(data, goal, f) {
  const box = $('#chart-trend');
  const t = Calc.trend(data, goal);
  if (!t) {
    box.textContent = 'כדי לחשב מגמה צריך לפחות 3 מדידות לאורך שבוע ומעלה.';
    return;
  }
  const dir = t.perWeek < 0 ? 'ירידה' : 'עלייה';
  const unit = f.unit === '%' ? '%' : ' ' + f.unit;
  let html = `מגמה: ${dir} של ${Math.abs(t.perWeek).toFixed(2)}${unit} בשבוע.`;
  if (goal == null) {
    if (f.key !== 'waist') html += ' ' + g('הגדר', 'הגדירי', 'אפשר להגדיר') + ' יעד בהגדרות.';
  } else if (t.reached) {
    html += ' הגעת ליעד 🎉';
  } else if (t.approaching) {
    html += `<br>בקצב הזה מגיעים ליעד בערך ב-${formatDate(t.etaDate)} (עוד ${Math.round(t.days / 7)} שבועות).`;
  } else {
    html += '<br>המגמה כרגע לא מתקרבת ליעד.';
  }
  // ירידה של יותר מ-1% ממשקל הגוף בשבוע מהירה מהמומלץ
  if (f.key === 'weight' && t.perWeek < 0 && Math.abs(t.perWeek) > t.current * 0.01) {
    html += '<br><span class="warn">הקצב מהיר מהמומלץ (עד כ-1% ממשקל הגוף בשבוע).</span>';
  }
  box.innerHTML = html;
}

function setupChartTabs() {
  for (const [id, set] of [['#chart-metric', v => { chartMetric = v; }], ['#chart-range', v => { chartRange = v; }]]) {
    $$(`${id} button`).forEach(b => b.addEventListener('click', () => {
      $$(`${id} button`).forEach(x => x.classList.toggle('on', x === b));
      set(b.dataset.metric || b.dataset.range);
      renderChart();
    }));
  }
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!$('[data-screen="body"]').hidden) renderChart(); }, 150);
  });
}

function onMeasureSubmit(e) {
  e.preventDefault();
  const form = $('#measure-form').elements;
  const status = $('#measure-status');
  const date = form.date.value;
  if (!date) return showStatus(status, 'צריך לבחור תאריך', false);
  if (date > today()) return showStatus(status, 'אי אפשר להזין תאריך עתידי', false);

  const m = { date };
  let any = false;
  for (const f of MEASURE_FIELDS) {
    const v = form[f.key].value.trim();
    if (v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < f.min || n > f.max) {
      return showStatus(status, `${f.label} צריך להיות בין ${f.min} ל-${f.max}`, false);
    }
    m[f.key] = n;
    any = true;
  }
  if (form.cycle.checked) { m.cycle = true; any = true; }
  if (!any) return showStatus(status, 'צריך למלא לפחות ערך אחד', false);

  const ok = Store.upsertMeasurement(m);
  showStatus(status, ok ? 'נשמר ✓' : 'השמירה נכשלה', ok);
  if (ok) {
    fillMeasureForm(date);
    renderMeasureList();
    renderChart();
  }
}

function renderMeasureList() {
  const list = $('#measure-list');
  const items = [...Store.get().measurements].reverse();
  $('#measure-empty').hidden = items.length > 0;
  list.innerHTML = '';
  for (const m of items) {
    const li = document.createElement('li');
    const vals = MEASURE_FIELDS
      .filter(f => m[f.key] != null)
      .map(f => `${f.label} ${m[f.key]}${f.unit === '%' ? '%' : ' ' + f.unit}`)
      .concat(m.cycle ? ['מחזור'] : [])
      .join(' · ');
    li.innerHTML = `
      <div class="info">
        <div class="date">${formatDate(m.date)}</div>
        <div class="vals"></div>
      </div>
      <button type="button" class="edit">עריכה</button>
      <button type="button" class="del">מחיקה</button>`;
    $('.vals', li).textContent = vals;
    $('.edit', li).addEventListener('click', () => {
      fillMeasureForm(m.date);
      $('#measure-status').textContent = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // מחיקה בשתי לחיצות
    const del = $('.del', li);
    del.addEventListener('click', () => {
      if (!del.classList.contains('sure')) {
        del.classList.add('sure');
        del.textContent = 'בטוח?';
        setTimeout(() => { del.classList.remove('sure'); del.textContent = 'מחיקה'; }, 3000);
        return;
      }
      Store.deleteMeasurement(m.date);
      resetMeasureForm();
    });
    list.appendChild(li);
  }
}

// הפעלה
Store.load();
$$('.tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('#profile-form').addEventListener('submit', onProfileSubmit);
$('#measure-form').addEventListener('submit', onMeasureSubmit);
$('#measure-form').elements.date.addEventListener('change', e => {
  if (e.target.value) fillMeasureForm(e.target.value);
});
setupChartTabs();
fillProfileForm();
go('home');
