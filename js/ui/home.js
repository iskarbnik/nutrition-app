// מסך ראשי: צלחת עם מה שנשאר, מאקרוס, מים, קפה, צעדים ומשקל
(() => {
  const CIRC = 2 * Math.PI * 16; // היקף העיגול ב-viewBox של 42
  const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  function renderPlate(t, tot) {
    $('#home-plate').hidden = false;
    $('#home-setup').hidden = true;

    // כל קשת היא החלק של המאקרו מהקלוריות של היום, ביחס ליעד
    const parts = [['protein', tot.protein * 4], ['carbs', tot.carbs * 4], ['fat', tot.fat * 9]];
    const scale = Math.min(1, t.kcal / Math.max(tot.protein * 4 + tot.carbs * 4 + tot.fat * 9, t.kcal));
    let offset = 0;
    for (const [k, kcal] of parts) {
      const len = Math.max(0, (kcal / t.kcal) * CIRC * scale);
      const arc = $(`.plate-arc.${k}`);
      arc.style.strokeDasharray = `${len} ${CIRC}`;
      arc.style.strokeDashoffset = String(-offset);
      offset += len;
    }

    const r = Days.remaining(t, tot);
    $('#home-plate').classList.toggle('over', r.over);
    $('#plate-num').textContent = fmt(Math.abs(r.kcal));
    $('#plate-label').textContent = r.over ? 'קלוריות מעל היעד' : 'קלוריות נשארו';
    $('#plate-sub').textContent = `נאכלו ${fmt(tot.kcal)} מתוך ${fmt(t.kcal)}. גרעון היום: ${fmt(t.tdee - tot.kcal)}`;

    const rows = [['protein', 'חלבון'], ['carbs', 'פחמימות'], ['fat', 'שומן']];
    $('#macros').innerHTML = rows.map(([k, label]) =>
      `<div class="macro ${k}"><i></i><span>${label}</span><b>${fmt(tot[k])}<small>/${fmt(t[k])}</small></b></div>`).join('');
  }

  function renderSetup() {
    $('#home-plate').hidden = true;
    $('#home-setup').hidden = false;
    $('#home-setup-text').textContent = g(
      'כדי לחשב כמה לאכול, מלא שנת לידה, מין וגובה, והזן משקל אחד.',
      'כדי לחשב כמה לאכול, מלאי שנת לידה, מין וגובה, והזיני משקל אחד.',
      'כדי לחשב כמה לאכול, צריך שנת לידה, מין, גובה ומשקל אחד.');
  }

  function renderWeight() {
    const s = Store.get();
    const ws = s.measurements.filter(m => m.weight != null).map(m => ({ date: m.date, value: m.weight }));
    if (!ws.length) {
      $('#wc-weight').textContent = '—';
      $('#wc-side').textContent = g('הוסף מדידה', 'הוסיפי מדידה', 'הוספת מדידה');
      return;
    }
    $('#wc-weight').textContent = `${ws[ws.length - 1].value} ק"ג`;
    const t = Calc.trend(ws, s.profile.goalWeight);
    const lines = [];
    // במילים ולא בסימן מינוס, שלא יתהפך בטקסט מימין לשמאל
    if (t) lines.push(`${t.perWeek <= 0 ? 'ירידה' : 'עלייה'} של ${Math.abs(t.perWeek).toFixed(1)} בשבוע`);
    if (s.profile.goalWeight) {
      if (t && t.reached) lines.push('הגעת ליעד');
      else if (t && t.approaching) lines.push(`יעד ${s.profile.goalWeight} ב-${formatDate(t.etaDate)}`);
      else lines.push(`יעד ${s.profile.goalWeight}`);
    }
    $('#wc-side').innerHTML = lines.map(esc).join('<br>');
  }

  function render() {
    const s = Store.get();
    const d = today();
    $('#home-date').textContent = dateFmt.format(new Date());
    $('#home-hello').textContent = s.profile.name ? `שלום ${s.profile.name}` : 'שלום';

    const warn = $('#home-warn');
    warn.hidden = Store.isPersistent();
    warn.textContent = 'הדפדפן חוסם שמירה בטלפון. הנתונים יימחקו כשסוגרים את האפליקציה.';

    const t = currentTargets();
    if (t) renderPlate(t, Days.totals(s, d)); else renderSetup();

    const day = s.days[d];
    const water = day ? day.water : 0;
    $('#water-val').textContent = `${water} ל'`;
    $('#water-goal').textContent = `מתוך ${s.profile.waterGoal}`;
    $('#coffee-val').textContent = day ? day.coffee.length : 0;
    $('#steps-val').textContent = day && day.steps != null ? fmt(day.steps) : '—';
    renderWeight();
  }

  // מים: חלונית עם הוספה והורדה
  function openWater() {
    const root = UI.sheet.open(`
      <h3 class="sheet-title">מים היום</h3>
      <div class="stepper">
        <button type="button" data-w="-0.25" aria-label="פחות רבע ליטר">−</button>
        <b id="w-val"></b>
        <button type="button" data-w="0.25" aria-label="עוד רבע ליטר">+</button>
      </div>
      <div class="chips"><button type="button" class="chip-btn" data-w="0.5">+ חצי ליטר</button><button type="button" class="chip-btn" data-w="1">+ ליטר</button></div>
      <p class="hint" id="w-goal"></p>`);
    const show = () => {
      const s = Store.get();
      const day = s.days[today()];
      $('#w-val', root).textContent = `${day ? day.water : 0} ל'`;
      $('#w-goal', root).textContent = `היעד: ${s.profile.waterGoal} ליטר. אפשר לשנות בהגדרות.`;
    };
    $$('[data-w]', root).forEach(b => b.addEventListener('click', () => {
      Store.mutate(s => Days.addWater(s, today(), Number(b.dataset.w)));
      show();
      render();
    }));
    show();
  }

  // קפה: הוספת כוס לפי סוג, והסרה של כוס שנרשמה
  function openCoffee() {
    const s = Store.get();
    const day = s.days[today()];
    const cups = day ? day.coffee : [];
    const name = id => (s.coffeeTypes.find(c => c.id === id) || { name: 'סוג שנמחק' }).name;
    const root = UI.sheet.open(`
      <h3 class="sheet-title">קפה היום</h3>
      ${s.coffeeTypes.length
        ? `<div class="list">${s.coffeeTypes.map(c => `
            <button type="button" class="list-main" data-cup="${c.id}"><span>+ ${esc(c.name)}</span><small>${fmt(c.kcal)} קל'</small></button>`).join('')}</div>`
        : `<p class="sheet-msg">עוד אין סוגי קפה. מוסיפים אותם בהגדרות, פעם אחת.</p>
           <button type="button" class="btn primary" id="to-settings">להגדרות</button>`}
      ${cups.length ? `<h4 class="sheet-sub">נרשמו היום</h4><div class="cups">${cups.map((id, i) =>
        `<button type="button" class="chip-btn" data-uncup="${i}">${esc(name(id))} ✕</button>`).join('')}</div>` : ''}`);
    $$('[data-cup]', root).forEach(b => b.addEventListener('click', () => {
      Store.mutate(st => Days.addCoffee(st, today(), b.dataset.cup));
      render();
      openCoffee();
    }));
    $$('[data-uncup]', root).forEach(b => b.addEventListener('click', () => {
      Store.mutate(st => Days.removeCoffee(st, today(), Number(b.dataset.uncup)));
      render();
      openCoffee();
    }));
    const ts = $('#to-settings', root);
    if (ts) ts.addEventListener('click', () => { UI.sheet.close(); go('settings'); });
  }

  function init() {
    $('#tile-water').addEventListener('click', openWater);
    $('#tile-coffee').addEventListener('click', openCoffee);
  }

  Screens.home = { init, render };
})();
