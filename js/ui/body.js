// מסך מדדים: גרף, טופס מדידה והיסטוריה
(() => {
  const FIELDS = [
    { key: 'weight', label: 'משקל', unit: 'ק"ג', min: 30, max: 300 },
    { key: 'fat', label: 'שומן', unit: '%', min: 3, max: 70 },
    { key: 'waist', label: 'מותניים', unit: 'ס"מ', min: 40, max: 200 },
    { key: 'height', label: 'גובה', unit: 'ס"מ', min: 120, max: 230 },
  ];
  let chartMetric = 'weight';
  let chartRange = '90';

  // ממלא את הטופס בערכים של התאריך שנבחר, אם יש
  function fillForm(date) {
    const form = $('#measure-form').elements;
    const m = Store.measurementOn(date);
    form.date.value = date;
    for (const f of FIELDS) form[f.key].value = m && m[f.key] != null ? m[f.key] : '';
    form.cycle.checked = !!(m && m.cycle);
    $('#cycle-row').hidden = Store.get().profile.sex === 'male';
    $('#measure-form h2').textContent = m ? `עריכת מדידה ${formatDate(date)}` : 'מדידה חדשה';
  }

  function render() {
    $('#measure-form').elements.date.max = today();
    fillForm(today());
    $('#measure-status').textContent = '';
    renderList();
    renderChart();
  }

  function renderChart() {
    const p = Store.get().profile;
    const all = Store.get().measurements;
    const f = FIELDS.find(x => x.key === chartMetric);
    const data = all.filter(m => m[f.key] != null).map(m => ({ date: m.date, value: m[f.key] }));
    const goal = chartMetric === 'weight' ? p.goalWeight : chartMetric === 'fat' ? p.goalFat : null;
    const showAvg = chartMetric === 'weight';
    const cycleDates = showAvg ? all.filter(m => m.cycle).map(m => m.date) : [];
    const fromDay = chartRange === 'all' ? null : Dates.toDay(today()) - Number(chartRange);

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

  function onSubmit(e) {
    e.preventDefault();
    const form = $('#measure-form').elements;
    const status = $('#measure-status');
    const date = form.date.value;
    if (!date) return showStatus(status, 'צריך לבחור תאריך', false);
    if (date > today()) return showStatus(status, 'אי אפשר להזין תאריך עתידי', false);

    const m = { date };
    let any = false;
    for (const f of FIELDS) {
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

    Store.upsertMeasurement(m);
    showStatus(status, 'נשמר ✓', true);
    fillForm(date);
    renderList();
    renderChart();
  }

  function renderList() {
    const list = $('#measure-list');
    const items = [...Store.get().measurements].reverse();
    $('#measure-empty').hidden = items.length > 0;
    list.innerHTML = '';
    for (const m of items) {
      const li = document.createElement('li');
      const vals = FIELDS
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
        <button type="button" class="del"></button>`;
      $('.vals', li).textContent = vals;
      $('.edit', li).addEventListener('click', () => {
        fillForm(m.date);
        $('#measure-status').textContent = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      twoTap($('.del', li), () => { Store.deleteMeasurement(m.date); render(); });
      list.appendChild(li);
    }
  }

  function init() {
    $('#measure-form').addEventListener('submit', onSubmit);
    $('#measure-form').elements.date.addEventListener('change', e => {
      if (e.target.value) fillForm(e.target.value);
    });
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

  Screens.body = { init, render };
})();
