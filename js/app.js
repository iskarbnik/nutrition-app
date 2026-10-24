// ניווט בין מסכים והפעלה
const TITLES = {
  home: 'ראשי',
  meals: 'ארוחות',
  body: 'מדדים',
  activity: 'פעילות',
  settings: 'הגדרות',
};
let current = 'home';

function go(screen) {
  current = screen;
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
    if (e.target.closest('[data-sheet-close]')) UI.sheet.close();
  });
  window.addEventListener('state-replaced', () => go(current));
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
