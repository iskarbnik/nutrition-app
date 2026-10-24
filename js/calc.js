// חישובים: מגמה והערכת זמן ליעד
(function (root) {
  const Dates = typeof require === 'function' ? require('./dates.js') : root.Dates;

  const TREND_DAYS = 28; // המגמה נמדדת על 4 השבועות האחרונים

  // רגרסיה לינארית: שיפוע ליום וערך בנקודה האחרונה
  function linearTrend(pts) {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.day, 0) / n;
    const my = pts.reduce((s, p) => s + p.value, 0) / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p.day - mx) * (p.value - my); den += (p.day - mx) ** 2; }
    const slope = den ? num / den : 0;
    const last = pts[n - 1].day;
    return { slope, current: my + slope * (last - mx), lastDay: last };
  }

  /**
   * data: [{date, value}] ממוין לפי תאריך
   * מחזיר null כשאין מספיק נתונים, אחרת:
   * { perWeek, current, reached, approaching, etaDate, days }
   */
  function trend(data, goal) {
    if (data.length < 3) return null;
    const pts = data.map(d => ({ day: Dates.toDay(d.date), value: d.value }));
    const lastDay = pts[pts.length - 1].day;
    const recent = pts.filter(p => p.day > lastDay - TREND_DAYS);
    if (recent.length < 3 || lastDay - recent[0].day < 7) return null;

    const { slope, current } = linearTrend(recent);
    const res = { perWeek: slope * 7, current, reached: false, approaching: false, etaDate: null, days: null };
    if (goal == null) return res;

    const wantDown = pts[0].value > goal;
    res.reached = wantDown ? current <= goal : current >= goal;
    if (res.reached) return res;

    res.approaching = wantDown ? slope < -0.001 : slope > 0.001;
    if (res.approaching) {
      res.days = Math.ceil((goal - current) / slope);
      res.etaDate = Dates.fromDay(lastDay + res.days);
    }
    return res;
  }

  const Calc = { trend };
  if (typeof module !== 'undefined') module.exports = Calc;
  else root.Calc = Calc;
})(this);
