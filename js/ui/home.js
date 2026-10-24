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

  function init() {
    // מים: כל לחיצה רבע ליטר
    $('#tile-water').addEventListener('click', () => {
      Store.mutate(s => Days.addWater(s, today(), 0.25));
      render();
    });
  }

  Screens.home = { init, render };
})();
