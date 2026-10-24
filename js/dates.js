// תאריכים: מפתח יום מקומי YYYY-MM-DD, וחשבון ימים
(function (root) {
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');

  // היום לפי השעון המקומי, לא לפי UTC
  function localDateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // מספר ימים מאז 1970 לפי המפתח עצמו (בלי תלות באזור זמן)
  function toDay(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
  }

  function fromDay(day) {
    return new Date(day * DAY).toISOString().slice(0, 10);
  }

  function addDays(iso, n) {
    return fromDay(toDay(iso) + n);
  }

  function formatHe(iso) {
    const [y, m, d] = iso.split('-');
    return `${Number(d)}.${Number(m)}.${y}`;
  }

  const Dates = { localDateKey, toDay, fromDay, addDays, formatHe };
  if (typeof module !== 'undefined') module.exports = Dates;
  else root.Dates = Dates;
})(this);
