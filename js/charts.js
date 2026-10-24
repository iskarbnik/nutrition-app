// גרף קו פשוט ב-SVG: נקודות מדידה, ממוצע 7 ימים, קו יעד וימי מחזור
(function (root) {
  const Dates = typeof require === 'function' ? require('./dates.js') : root.Dates;
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 86400000;


  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ממוצע של כל המדידות ב-7 הימים שמסתיימים בכל נקודה
  function rollingAvg(points) {
    return points.map(p => {
      const win = points.filter(q => q.day <= p.day && q.day > p.day - 7);
      return { day: p.day, value: win.reduce((s, q) => s + q.value, 0) / win.length };
    });
  }

  // מספרים עגולים לציר
  function niceTicks(min, max, count) {
    const raw = (max - min) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    const start = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step * 0.01; v += step) ticks.push(+v.toFixed(4));
    if (ticks[ticks.length - 1] < max) ticks.push(+(ticks[ticks.length - 1] + step).toFixed(4));
    return ticks;
  }

  const fmtShort = day => {
    const d = new Date(day * DAY);
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  };

  /**
   * opts: { data: [{date, value}], goal, unit, showAvg, cycleDates: [iso], fromDay }
   */
  function line(container, opts) {
    container.innerHTML = '';
    const pts = opts.data
      .map(d => ({ day: Dates.toDay(d.date), value: d.value }))
      .filter(p => opts.fromDay == null || p.day >= opts.fromDay);

    if (pts.length === 0) {
      container.innerHTML = '<p class="muted chart-empty">אין מספיק נתונים לגרף בטווח הזה.</p>';
      return;
    }

    const W = Math.max(container.clientWidth, 260);
    const H = 220;
    const m = { top: 12, right: 12, bottom: 26, left: 40 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;

    let x0 = pts[0].day, x1 = pts[pts.length - 1].day;
    if (x1 - x0 < 6) { x0 = x1 - 6; } // לפחות שבוע ברוחב
    const vals = pts.map(p => p.value);
    if (opts.goal != null) vals.push(opts.goal);
    let y0 = Math.min(...vals), y1 = Math.max(...vals);
    const pad = Math.max((y1 - y0) * 0.1, 0.5);
    const ticks = niceTicks(y0 - pad, y1 + pad, 4);
    y0 = ticks[0]; y1 = ticks[ticks.length - 1];

    const X = d => m.left + (x1 === x0 ? iw / 2 : (d - x0) / (x1 - x0) * iw);
    const Y = v => m.top + (1 - (v - y0) / (y1 - y0)) * ih;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart', role: 'img' });

    // ימי מחזור כרצועות רקע
    const dayW = Math.max(iw / Math.max(x1 - x0, 1), 2);
    for (const iso of opts.cycleDates || []) {
      const d = Dates.toDay(iso);
      if (d < x0 - 0.5 || d > x1 + 0.5) continue;
      el('rect', { x: X(d) - dayW / 2, y: m.top, width: dayW, height: ih, class: 'c-cycle' }, svg);
    }

    // רשת וציר Y
    for (const t of ticks) {
      el('line', { x1: m.left, x2: W - m.right, y1: Y(t), y2: Y(t), class: 'c-grid' }, svg);
      const lbl = el('text', { x: m.left - 6, y: Y(t) + 4, 'text-anchor': 'end', class: 'c-axis' }, svg);
      lbl.textContent = t;
    }

    // ציר X: עד 4 תאריכים
    const span = x1 - x0;
    const n = Math.min(4, Math.max(1, Math.floor(span / 2)));
    for (let i = 0; i <= n; i++) {
      const d = Math.round(x0 + span * i / n);
      const anchor = i === 0 ? 'start' : i === n ? 'end' : 'middle';
      const lbl = el('text', { x: X(d), y: H - 6, 'text-anchor': anchor, class: 'c-axis' }, svg);
      lbl.textContent = fmtShort(d);
    }

    // קו יעד
    if (opts.goal != null) {
      el('line', { x1: m.left, x2: W - m.right, y1: Y(opts.goal), y2: Y(opts.goal), class: 'c-goal' }, svg);
      const gl = el('text', { x: W - m.right - 2, y: Y(opts.goal) - 5, 'text-anchor': 'end', class: 'c-goal-label' }, svg);
      gl.textContent = `יעד ${opts.goal}`;
    }

    // קו המדידות
    const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)},${Y(p.value).toFixed(1)}`).join('');
    el('path', { d: path(pts), class: opts.showAvg ? 'c-raw-line' : 'c-main-line' }, svg);

    const avg = opts.showAvg && pts.length > 1 ? rollingAvg(pts) : null;
    if (avg) el('path', { d: path(avg), class: 'c-main-line' }, svg);

    for (const p of pts) {
      el('circle', { cx: X(p.day), cy: Y(p.value), r: 4, class: opts.showAvg ? 'c-raw-dot' : 'c-main-dot' }, svg);
    }

    // שכבת ריחוף: קו אנכי ותווית לנקודה הקרובה
    const cross = el('line', { y1: m.top, y2: m.top + ih, class: 'c-cross', visibility: 'hidden' }, svg);
    const ring = el('circle', { r: 6, class: 'c-focus', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.left, y: 0, width: iw, height: H, fill: 'transparent' }, svg);

    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;

    const cycleSet = new Set(opts.cycleDates || []);
    function show(evt) {
      const r = svg.getBoundingClientRect();
      const px = (evt.clientX - r.left) * (W / r.width);
      let best = 0;
      pts.forEach((p, i) => { if (Math.abs(X(p.day) - px) < Math.abs(X(pts[best].day) - px)) best = i; });
      const p = pts[best];
      const cx = X(p.day), cy = Y(p.value);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
      cross.setAttribute('visibility', 'visible');
      ring.setAttribute('cx', cx); ring.setAttribute('cy', cy);
      ring.setAttribute('visibility', 'visible');
      const iso = Dates.fromDay(p.day);
      let html = `<b>${fmtShort(p.day)}</b> · ${p.value} ${opts.unit}`;
      if (avg) html += `<br>ממוצע 7 ימים: ${avg[best].value.toFixed(1)}`;
      if (cycleSet.has(iso)) html += '<br>יום מחזור';
      tip.innerHTML = html;
      tip.hidden = false;
      const left = Math.min(Math.max(cx * r.width / W - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth);
      tip.style.left = left + 'px';
      tip.style.top = Math.max(cy * r.height / H - tip.offsetHeight - 12, 0) + 'px';
    }
    function hide() {
      cross.setAttribute('visibility', 'hidden');
      ring.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);

    container.appendChild(svg);
    container.appendChild(tip);
  }

  const Charts = { line, rollingAvg };
  if (typeof module !== 'undefined') module.exports = Charts;
  else root.Charts = Charts;
})(this);
