// סיכום שבועי: 7 הימים שמסתיימים בתאריך הנתון
(function (root) {
  const req = typeof require === 'function';
  const Dates = req ? require('./dates.js') : root.Dates;
  const Days = req ? require('./days.js') : root.Days;

  const round1 = n => Math.round(n * 10) / 10;
  const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

  // targetsFn(date) מחזיר יעדים או null
  function stats(state, targetsFn, endDate) {
    const from = Dates.addDays(endDate, -6);
    const dates = Array.from({ length: 7 }, (_, i) => Dates.addDays(from, i));

    const logged = dates.filter(d => {
      const day = state.days[d];
      return day && Days.MEALS.some(m => day.meals[m].length);
    });
    const totals = logged.map(d => ({ d, t: Days.totals(state, d) }));

    let daysInBudget = null;
    const withTargets = totals.map(x => ({ ...x, target: targetsFn(x.d) })).filter(x => x.target);
    if (withTargets.length) daysInBudget = withTargets.filter(x => x.t.kcal <= x.target.kcal).length;

    const weights = state.measurements.filter(m => m.weight != null && m.date >= from && m.date <= endDate);
    const weightChange = weights.length >= 2 ? round1(weights[weights.length - 1].weight - weights[0].weight) : null;

    const water = dates.map(d => state.days[d] && state.days[d].water).filter(v => v > 0);
    const steps = dates.map(d => state.days[d] && state.days[d].steps).filter(v => v != null);

    const a = (list, k) => { const v = avg(list.map(x => x.t[k])); return v == null ? null : Math.round(v); };
    const w = avg(water);
    const s = avg(steps);
    return {
      from,
      to: endDate,
      daysLogged: logged.length,
      avgKcal: a(totals, 'kcal'),
      avgProtein: a(totals, 'protein'),
      daysInBudget,
      weightChange,
      avgWater: w == null ? null : round1(w),
      avgSteps: s == null ? null : Math.round(s),
    };
  }

  const Week = { stats };
  if (typeof module !== 'undefined') module.exports = Week;
  else root.Week = Week;
})(this);
