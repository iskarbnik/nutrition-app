// שמירת כל הנתונים באובייקט אחד ב-localStorage
const Store = (() => {
  const KEY = 'ori-nutrition';
  const VERSION = 1;

  const empty = () => ({
    version: VERSION,
    profile: {
      name: '',
      birthYear: null,
      sex: null,
      height: null,
      activity: 1.2,
      goalWeight: null,
      goalFat: null,
    },
    measurements: [], // { date, weight, fat, waist, height }
    days: {},         // 'YYYY-MM-DD' -> { meals, water, coffee, steps }
  });

  let data;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
    } catch {
      data = empty();
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function get() { return data || load(); }

  function updateProfile(patch) {
    get().profile = { ...data.profile, ...patch };
    return save();
  }

  // מדידה אחת לכל תאריך. שמירה בתאריך קיים מחליפה אותו
  function upsertMeasurement(m) {
    const list = get().measurements.filter(x => x.date !== m.date);
    list.push(m);
    list.sort((a, b) => a.date.localeCompare(b.date));
    data.measurements = list;
    // הגובה האחרון שנמדד הוא הגובה בפרופיל
    const lastHeight = [...list].reverse().find(x => x.height);
    if (lastHeight) data.profile.height = lastHeight.height;
    return save();
  }

  function deleteMeasurement(date) {
    get().measurements = data.measurements.filter(x => x.date !== date);
    return save();
  }

  function measurementOn(date) {
    return get().measurements.find(x => x.date === date) || null;
  }

  return { load, save, get, updateProfile, upsertMeasurement, deleteMeasurement, measurementOn };
})();
