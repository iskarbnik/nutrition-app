// סיכום שבועי: נפתח מהמסך הראשי, עם טיפ מ-AI שנשמר לכל שבוע
(() => {
  // היעדים של יום מסוים לפי המדידה האחרונה עד אותו יום
  function targetsOn(date) {
    const s = Store.get();
    const upTo = { ...s, measurements: s.measurements.filter(m => m.date <= date) };
    return Targets.compute(s.profile, State.latestMeasurement(upTo), date);
  }

  function row(label, value) {
    return `<div class="week-row"><span>${label}</span><b>${value}</b></div>`;
  }

  function open() {
    const s = Store.get();
    const w = Week.stats(s, targetsOn, today());
    const dash = '—';
    const change = w.weightChange == null ? dash
      : w.weightChange === 0 ? 'ללא שינוי'
        : `${w.weightChange < 0 ? 'ירידה' : 'עלייה'} של ${Math.abs(w.weightChange)} ק"ג`;
    const tip = s.weekTips[w.from];
    const root = UI.sheet.open(`
      <h3 class="sheet-title">השבוע: ${formatDate(w.from)} עד ${formatDate(w.to)}</h3>
      <div class="week-rows">
        ${row('ימים עם רישום', `${w.daysLogged} מתוך 7`)}
        ${row('ממוצע קלוריות ביום', w.avgKcal == null ? dash : fmt(w.avgKcal))}
        ${row('ממוצע חלבון ביום', w.avgProtein == null ? dash : `${w.avgProtein} ג'`)}
        ${row('ימים בתוך התקציב', w.daysInBudget == null ? dash : `${w.daysInBudget} מתוך ${w.daysWithTargets}`)}
        ${row('משקל', change)}
        ${row('מים בממוצע', w.avgWater == null ? dash : `${w.avgWater} ל'`)}
        ${row('צעדים בממוצע', w.avgSteps == null ? dash : fmt(w.avgSteps))}
      </div>
      <div class="tip" id="week-tip" ${tip ? '' : 'hidden'}>${tip ? esc(tip) : ''}</div>
      ${tip ? '' : `<button type="button" class="btn" id="get-tip" ${w.daysLogged ? '' : 'disabled'}>טיפ מ-AI לשבוע הבא</button>`}
      <p class="status" id="tip-status" role="status"></p>`);
    const btn = $('#get-tip', root);
    if (btn) btn.addEventListener('click', () => getTip(w, root));
  }

  async function getTip(w, root) {
    const status = $('#tip-status', root);
    const provider = Store.get().settings.aiProvider;
    const key = await Secrets.get(Screens.settings.PROVIDERS[provider].key);
    if (!key) return showStatus(status, 'כדי לקבל טיפ צריך להזין מפתח AI בהגדרות.', false);
    showWaiting(status, 'מכין טיפ...');
    const btn = $('#get-tip', root);
    btn.disabled = true;
    try {
      const tip = AI.parseTip(await AI.ask(provider, key, { text: AI.tipPrompt(w, Store.get().profile.sex) }));
      if (!tip) throw new Error('ai-failed');
      Store.mutate(s => { s.weekTips[w.from] = tip; });
      open();
    } catch (err) {
      showStatus(status, aiErrorText(err, 'לא הצלחתי להכין טיפ. אפשר לנסות שוב.'), false);
      btn.disabled = false;
    }
  }

  Screens.week = { init() {}, render() {}, open };
})();
