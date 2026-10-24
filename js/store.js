// עותק העבודה בזיכרון, שנשמר ל-IndexedDB
// כל שינוי עובר דרך mutate: מסמן שצריך סנכרון ומודיע למסכים
const Store = (() => {
  const LEGACY_KEY = 'ori-nutrition';
  let state = State.empty();
  let meta = { dirty: false, lastSyncAt: 0, lastBackupDate: null, driveFolderId: null, dataFileId: null };
  let timer;

  let persistent = true;

  // אם אין אחסון בטלפון, עובדים מהזיכרון בלבד ומציגים אזהרה
  async function init() {
    try {
      await load();
    } catch {
      persistent = false;
      state = State.migrate(readLegacy());
    }
    return state;
  }

  function readLegacy() {
    try { return JSON.parse(localStorage.getItem(LEGACY_KEY)); } catch { return null; }
  }

  async function load() {
    const saved = await DB.get('kv', 'state');
    if (saved) {
      state = State.migrate(saved);
    } else {
      // העברה חד-פעמית מהגרסה שנשמרה ב-localStorage
      const legacy = readLegacy();
      state = State.migrate(legacy);
      if (legacy) {
        await DB.put('kv', 'state', state);
        try { localStorage.removeItem(LEGACY_KEY); } catch { /* לא חשוב */ }
      }
    }
    meta = { ...meta, ...(await DB.get('kv', 'meta')) };
  }

  const get = () => state;
  const getMeta = () => meta;

  // כתיבה שקטה: בלי אחסון, הנתונים נשארים רק בזיכרון
  const write = (key, value) => (persistent ? DB.put('kv', key, value).catch(() => {}) : Promise.resolve());

  function persist() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      write('state', state);
      write('meta', meta);
    }, 300);
  }

  function setMeta(patch) {
    meta = { ...meta, ...patch };
    return write('meta', meta);
  }

  function mutate(fn) {
    fn(state);
    state.updatedAt = Date.now();
    meta.dirty = true;
    persist();
    window.dispatchEvent(new Event('state-changed'));
    return true;
  }

  // החלפה מלאה (רענון או שחזור מהדרייב). לא מסמן לסנכרון
  async function replace(next) {
    state = State.migrate(next);
    meta.dirty = false;
    await write('state', state);
    await write('meta', meta);
    window.dispatchEvent(new Event('state-replaced'));
  }

  const updateProfile = patch => mutate(s => { s.profile = { ...s.profile, ...patch }; });
  const upsertMeasurement = m => mutate(s => State.upsertMeasurement(s, m));
  const deleteMeasurement = date => mutate(s => State.deleteMeasurement(s, date));
  const measurementOn = date => State.measurementOn(state, date);

  const isPersistent = () => persistent;

  return { init, isPersistent, get, getMeta, setMeta, mutate, replace, updateProfile, upsertMeasurement, deleteMeasurement, measurementOn };
})();
