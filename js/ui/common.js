// עזרים משותפים למסכים
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const Screens = {};

const today = () => Dates.localDateKey();
const formatDate = Dates.formatHe;

// טקסט לפי המין בהגדרות. בלי מין: ניסוח ניטרלי
function g(male, female, neutral) {
  const sex = Store.get().profile.sex;
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return neutral;
}

function showStatus(el, text, ok) {
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'err');
  clearTimeout(el._t);
  if (ok) el._t = setTimeout(() => { el.textContent = ''; }, 2500);
}

// כפתור מחיקה בשתי לחיצות: "מחיקה" ← "בטוח?"
function twoTap(btn, onConfirm, label = 'מחיקה') {
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('sure')) {
      btn.classList.add('sure');
      btn.textContent = 'בטוח?';
      setTimeout(() => { btn.classList.remove('sure'); btn.textContent = label; }, 3000);
      return;
    }
    onConfirm();
  });
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('he-IL');

// חלונית תחתונה והודעה קצרה
const UI = {
  toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.hidden = true; }, 2500);
  },
  // open(html) או open({ locked: true }, html). חלונית נעולה לא נסגרת בלחיצה בחוץ או בכפתור "חזרה"
  // כפתור "חזרה" של אנדרואיד סוגר את החלונית ולא את האפליקציה
  sheet: {
    locked: false,
    inHistory: false,
    open(a, b) {
      const opts = typeof a === 'string' ? {} : a;
      this.locked = !!opts.locked;
      $('#sheet-body').innerHTML = typeof a === 'string' ? a : b;
      $('#sheet').hidden = false;
      document.body.classList.add('sheet-open');
      if (!this.inHistory) {
        history.pushState({ sheet: true }, '');
        this.inHistory = true;
      }
      return $('#sheet-body');
    },
    close(fromBack = false) {
      if ($('#sheet').hidden) return;
      $('#sheet').hidden = true;
      document.body.classList.remove('sheet-open');
      $('#sheet-body').innerHTML = '';
      this.locked = false;
      if (this.inHistory) {
        this.inHistory = false;
        if (!fromBack) history.back();
      }
    },
    dismiss() {
      if (!this.locked) this.close();
    },
  },
};

// היעדים של היום לפי הפרופיל והמדידה האחרונה
function currentTargets() {
  const s = Store.get();
  return Targets.compute(s.profile, State.latestMeasurement(s), today());
}

// מפתחות AI: בטלפון בלבד. בלי אחסון, בזיכרון בלבד
const Secrets = (() => {
  const mem = {};
  return {
    async get(name) {
      if (name in mem) return mem[name];
      try { mem[name] = (await DB.get('secrets', name)) || ''; } catch { mem[name] = ''; }
      return mem[name];
    },
    async set(name, value) {
      mem[name] = value;
      try { await DB.put('secrets', name, value); } catch { /* נשאר בזיכרון */ }
    },
    async clear(name) {
      mem[name] = '';
      try { await DB.del('secrets', name); } catch { /* לא חשוב */ }
    },
  };
})();
