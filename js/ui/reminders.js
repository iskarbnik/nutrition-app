// תזכורות: הגדרות, בדיקה כל רבע שעה כשהאפליקציה פתוחה, והתראה או פס במסך הראשי
(() => {
  const CHECK_EVERY = 15 * 60 * 1000;
  const MEAL_NAMES = { breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב' };

  function text(key) {
    const s = Store.get();
    if (key === 'weigh') return 'זמן לשקילה של היום. כדאי לשקול לפני האוכל.';
    if (key === 'water') {
      const day = s.days[today()];
      return `שתית ${day ? day.water : 0} מתוך ${s.profile.waterGoal} ליטר. זה זמן טוב לכוס מים.`;
    }
    const meal = key.replace('meal-', '');
    return `עוד לא נרשמה ארוחת ${MEAL_NAMES[meal]}. ${g('אכלת? אפשר לרשום עכשיו.', 'אכלת? אפשר לרשום עכשיו.', 'אפשר לרשום עכשיו.')}`;
  }

  function context() {
    const s = Store.get();
    const d = today();
    const day = s.days[d];
    const has = m => !!(day && day.meals[m].length);
    return {
      weighedToday: s.measurements.some(m => m.date === d && m.weight != null),
      water: day ? day.water : 0,
      waterGoal: s.profile.waterGoal,
      mealsLogged: { breakfast: has('breakfast'), lunch: has('lunch'), dinner: has('dinner') },
    };
  }

  let banners = [];

  async function check() {
    const meta = Store.getMeta();
    const shown = meta.remindersShown || {};
    const list = Reminders.due(Store.get().settings.reminders, shown, new Date(), context());
    if (!list.length) return;
    const now = new Date().toISOString();
    const next = { ...shown };
    for (const r of list) {
      next[r.key] = now;
      const body = text(r.key);
      // התראה של המערכת רק כשהאפליקציה ברקע. אחרת פס במסך הראשי
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
          if (reg) reg.showNotification('תזונה ומשקל', { body, tag: r.key, lang: 'he', dir: 'rtl' });
          else new Notification('תזונה ומשקל', { body, tag: r.key });
        } catch { banners.push(r.key); }
      } else {
        banners.push(r.key);
      }
    }
    await Store.setMeta({ remindersShown: next });
    renderBanners();
  }

  function renderBanners() {
    banners = [...new Set(banners)];
    const box = $('#home-reminders');
    if (!box) return;
    box.innerHTML = banners.map(k => `
      <div class="reminder">
        <span>${esc(text(k))}</span>
        <button type="button" class="chip-btn" data-dismiss="${k}" aria-label="סגירה">✕</button>
      </div>`).join('');
  }

  // הגדרות
  function fill() {
    const r = Store.get().settings.reminders;
    $('#rem-weigh').checked = r.weigh.on;
    $('#rem-weigh-time').value = r.weigh.time;
    $('#rem-water').checked = r.water.on;
    $('#rem-water-every').value = String(r.water.every);
    $('#rem-meals').checked = r.meals.on;
    $$('#rem-meal-times input').forEach(inp => { inp.value = r.meals.times[Number(inp.dataset.i)]; });
    $('#rem-meal-times').hidden = !r.meals.on;
  }

  async function save() {
    const anyOn = $('#rem-weigh').checked || $('#rem-water').checked || $('#rem-meals').checked;
    Store.mutate(s => {
      const r = s.settings.reminders;
      r.weigh = { on: $('#rem-weigh').checked, time: $('#rem-weigh-time').value || '07:30' };
      r.water = { on: $('#rem-water').checked, every: Number($('#rem-water-every').value) };
      r.meals = { on: $('#rem-meals').checked, times: $$('#rem-meal-times input').map((inp, i) => inp.value || r.meals.times[i]) };
    });
    fill();
    if (anyOn && 'Notification' in window && Notification.permission === 'default') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') showStatus($('#rem-status'), 'בלי אישור להתראות, התזכורות יופיעו רק בתוך האפליקציה.', false);
    }
  }

  function init() {
    ['#rem-weigh', '#rem-weigh-time', '#rem-water', '#rem-water-every', '#rem-meals'].forEach(sel => $(sel).addEventListener('change', save));
    $$('#rem-meal-times input').forEach(inp => inp.addEventListener('change', save));
    $('#home-reminders').addEventListener('click', e => {
      const b = e.target.closest('[data-dismiss]');
      if (!b) return;
      banners = banners.filter(k => k !== b.dataset.dismiss);
      renderBanners();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, CHECK_EVERY);
    check();
  }

  Screens.reminders = { init, render: fill, check };
})();
