// מסך פעילות: הזנת צעדים וגרף שבועי
(() => {
  function fillForm(date) {
    const form = $('#steps-form').elements;
    const day = Store.get().days[date];
    form.date.value = date;
    form.steps.value = day && day.steps != null ? day.steps : '';
  }

  function renderChart() {
    const s = Store.get();
    const end = today();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = Dates.addDays(end, -i);
      const day = s.days[date];
      data.push({ date, value: day && day.steps != null ? day.steps : null });
    }
    Charts.bars($('#steps-chart'), { data, unit: 'צעדים' });
    const known = data.filter(d => d.value != null);
    $('#steps-avg').textContent = known.length
      ? `ממוצע של ${fmt(known.reduce((a, d) => a + d.value, 0) / known.length)} צעדים ביום (${known.length} ימים עם נתונים).`
      : 'עוד אין צעדים השבוע.';
  }

  function render() {
    $('#steps-form').elements.date.max = today();
    fillForm(today());
    renderChart();
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = $('#steps-form').elements;
    const status = $('#steps-status');
    const date = form.date.value;
    const n = Number(form.steps.value);
    if (!date || date > today()) return showStatus(status, 'צריך תאריך של היום או לפני', false);
    if (form.steps.value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100000) {
      return showStatus(status, 'מספר הצעדים צריך להיות בין 0 ל-100,000', false);
    }
    Store.mutate(s => Days.setSteps(s, date, n));
    showStatus(status, 'נשמר ✓', true);
    renderChart();
  }

  function init() {
    $('#steps-form').addEventListener('submit', onSubmit);
    $('#steps-form').elements.date.addEventListener('change', e => { if (e.target.value) fillForm(e.target.value); });
  }

  Screens.activity = { init, render };
})();
