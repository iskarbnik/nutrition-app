// ניווט בין מסכים והפעלה
const TITLES = {
  home: 'ראשי',
  meals: 'ארוחות',
  body: 'מדדים',
  activity: 'פעילות',
  settings: 'הגדרות',
};
let current = 'home';
let renderedDay = null;

function go(screen) {
  current = screen;
  renderedDay = today();
  $$('.screen').forEach(s => { s.hidden = s.dataset.screen !== screen; });
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.go === screen));
  $('#screen-title').textContent = TITLES[screen];
  if (Screens[screen]) Screens[screen].render();
  window.scrollTo(0, 0);
}

function start() {
  for (const s of Object.values(Screens)) s.init();
  // כל כפתור עם data-go מנווט, גם בתוך המסכים
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b && !e.defaultPrevented) go(b.dataset.go);
    if (e.target.closest('[data-sheet-close]')) UI.sheet.dismiss();
  });
  window.addEventListener('popstate', () => {
    if ($('#sheet').hidden) return;
    if (UI.sheet.locked) { history.pushState({ sheet: true }, ''); return; }
    UI.sheet.close(true);
  });
  window.addEventListener('state-replaced', () => go(current));

  // יום חדש: אם האפליקציה נשארה פתוחה או ברקע מעבר לחצות, מציגים את היום הנכון
  const refreshIfNewDay = () => { if (today() !== renderedDay) go(current); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Store.flush(); else refreshIfNewDay();
  });
  window.addEventListener('pagehide', () => Store.flush());
  setInterval(refreshIfNewDay, 60 * 1000);
  go('home');
}

// גרסה חדשה של האפליקציה: מציעים לרענן, לא מרעננים לבד באמצע עבודה
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload();
  });
  const offer = worker => {
    const bar = $('#update-bar');
    bar.hidden = false;
    $('#update-btn').onclick = () => { reloading = true; worker.postMessage('SKIP_WAITING'); };
  };
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    // אפליקציה מותקנת נשארת פתוחה ברקע: בודקים גרסה חדשה בכל חזרה אליה
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
    $('#check-update').addEventListener('click', async () => {
      const status = $('#update-status');
      try {
        await reg.update();
        const fresh = reg.installing || reg.waiting;
        if (fresh) showStatus(status, 'נמצאה גרסה חדשה. לוחצים "רענון" בפס למטה.', true);
        else showStatus(status, 'זו הגרסה האחרונה', true);
      } catch {
        showStatus(status, 'אין חיבור לאינטרנט', false);
      }
    });
    const ctl = navigator.serviceWorker.controller;
    if (ctl) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data && e.data.version) $('#app-version').textContent = 'גרסה ' + e.data.version.replace('app-v', '');
      });
      ctl.postMessage('VERSION');
    }
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(() => { /* בלי service worker האפליקציה עדיין עובדת ברשת */ });
}

Store.init().then(start);
registerServiceWorker();
