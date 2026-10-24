// תזכורות: מה צריך להזכיר עכשיו. בלי DOM, כדי שאפשר לבדוק
// settings: { weigh: {on, time}, water: {on, every}, meals: {on, times: [בוקר, צהריים, ערב]} }
// lastShown: { key: ISO } — מתי כל תזכורת הוצגה לאחרונה
// ctx: { weighedToday, water, waterGoal, mealsLogged: {breakfast, lunch, dinner} }
(function (root) {
  const Dates = typeof require === 'function' ? require('./dates.js') : root.Dates;
  const MEALS = ['breakfast', 'lunch', 'dinner'];
  const WATER_FROM = 8 * 60;
  const WATER_TO = 22 * 60;
  const MEAL_GRACE = 60;

  const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const nowMin = d => d.getHours() * 60 + d.getMinutes();
  const shownToday = (iso, now) => !!iso && Dates.localDateKey(new Date(iso)) === Dates.localDateKey(now);

  // מחזיר [{ key }] לפי הסדר: שקילה, מים, ארוחות
  function due(settings, lastShown, now, ctx) {
    const out = [];
    const t = nowMin(now);
    const s = settings || {};

    if (s.weigh && s.weigh.on && !ctx.weighedToday && t >= minutes(s.weigh.time) && !shownToday(lastShown.weigh, now)) {
      out.push({ key: 'weigh' });
    }

    if (s.water && s.water.on && t >= WATER_FROM && t < WATER_TO && ctx.water < ctx.waterGoal) {
      const last = lastShown.water ? new Date(lastShown.water).getTime() : 0;
      if (now.getTime() - last >= s.water.every * 3600000) out.push({ key: 'water' });
    }

    if (s.meals && s.meals.on) {
      MEALS.forEach((meal, i) => {
        const key = `meal-${meal}`;
        if (!ctx.mealsLogged[meal] && t >= minutes(s.meals.times[i]) + MEAL_GRACE && !shownToday(lastShown[key], now)) {
          out.push({ key });
        }
      });
    }
    return out;
  }

  const Reminders = { due };
  if (typeof module !== 'undefined') module.exports = Reminders;
  else root.Reminders = Reminders;
})(this);
