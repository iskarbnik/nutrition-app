// מבנה הנתונים: ריק, העברה מגרסה ישנה, בדיקת תקינות ומדידות
(function (root) {
  const VERSION = 2;

  const empty = () => ({
    version: VERSION,
    updatedAt: 0,
    profile: {
      name: '',
      birthYear: null,
      sex: null,
      height: null,
      activity: 1.2,
      goalWeight: null,
      goalFat: null,
      waterGoal: 2.5,
      overrides: {},
    },
    measurements: [], // { date, weight, fat, waist, height, cycle }
    days: {},         // 'YYYY-MM-DD' -> { meals, water, coffee, steps }
    savedMeals: [],
    recentItems: [],
    coffeeTypes: [],
    weekTips: {},
    settings: {
      aiProvider: 'gemini',
      reminders: {
        weigh: { on: false, time: '07:30' },
        water: { on: false, every: 2 },
        meals: { on: false, times: ['09:00', '13:30', '19:30'] },
      },
    },
  });

  // ממלא שדות חסרים מתוך מבנה ריק
  function migrate(raw) {
    const e = empty();
    if (!raw || typeof raw !== 'object') return e;
    const arr = (v, d) => (Array.isArray(v) ? v : d);
    const obj = (v, d) => (v && typeof v === 'object' && !Array.isArray(v) ? v : d);
    const settings = obj(raw.settings, {});
    return {
      ...e,
      updatedAt: raw.updatedAt || 0,
      profile: { ...e.profile, ...obj(raw.profile, {}) },
      measurements: arr(raw.measurements, []),
      days: obj(raw.days, {}),
      savedMeals: arr(raw.savedMeals, []),
      recentItems: arr(raw.recentItems, []),
      coffeeTypes: arr(raw.coffeeTypes, []),
      weekTips: obj(raw.weekTips, {}),
      settings: {
        ...e.settings,
        ...settings,
        reminders: { ...e.settings.reminders, ...obj(settings.reminders, {}) },
      },
    };
  }

  function validate(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'הקובץ לא מכיל נתונים של האפליקציה' };
    if (typeof o.version !== 'number' || o.version > VERSION) return { ok: false, error: 'הקובץ מגרסה חדשה יותר של האפליקציה' };
    if (!o.profile || typeof o.profile !== 'object') return { ok: false, error: 'חסרים פרטים אישיים בקובץ' };
    if (!Array.isArray(o.measurements)) return { ok: false, error: 'רשימת המדידות בקובץ פגומה' };
    if (o.days && typeof o.days !== 'object') return { ok: false, error: 'נתוני הימים בקובץ פגומים' };
    return { ok: true };
  }

  // מדידה אחת לכל תאריך. שמירה בתאריך קיים מחליפה אותו
  function upsertMeasurement(state, m) {
    const list = state.measurements.filter(x => x.date !== m.date);
    list.push(m);
    list.sort((a, b) => a.date.localeCompare(b.date));
    state.measurements = list;
    // הגובה האחרון שנמדד הוא הגובה בפרופיל
    const lastHeight = [...list].reverse().find(x => x.height);
    if (lastHeight) state.profile.height = lastHeight.height;
  }

  function deleteMeasurement(state, date) {
    state.measurements = state.measurements.filter(x => x.date !== date);
  }

  function measurementOn(state, date) {
    return state.measurements.find(x => x.date === date) || null;
  }

  // המשקל ואחוז השומן העדכניים ביותר, גם אם נמדדו בימים שונים
  function latestMeasurement(state) {
    const rev = [...state.measurements].reverse();
    const w = rev.find(x => x.weight != null);
    if (!w) return null;
    const f = rev.find(x => x.fat != null);
    return { weight: w.weight, fat: f ? f.fat : null };
  }

  const State = { VERSION, empty, migrate, validate, upsertMeasurement, deleteMeasurement, measurementOn, latestMeasurement };
  if (typeof module !== 'undefined') module.exports = State;
  else root.State = State;
})(this);
