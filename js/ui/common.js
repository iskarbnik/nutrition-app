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

// חלונית תחתונה
const UI = {
  sheet: {
    open(html) {
      const wrap = $('#sheet');
      $('#sheet-body').innerHTML = html;
      wrap.hidden = false;
      document.body.classList.add('sheet-open');
      return $('#sheet-body');
    },
    close() {
      $('#sheet').hidden = true;
      document.body.classList.remove('sheet-open');
      $('#sheet-body').innerHTML = '';
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
