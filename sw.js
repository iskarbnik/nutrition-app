// Service worker: קבצי האפליקציה נשמרים בטלפון, כדי שתעבוד גם בלי אינטרנט
// בכל שינוי בקבצים מעלים את מספר הגרסה, והאפליקציה תציע לעדכן
const VERSION = 'app-v11';
const FONTS = 'fonts-v1';

const FILES = [
  './',
  'index.html',
  'manifest.json',
  'styles.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'js/dates.js',
  'js/config.js',
  'js/state.js',
  'js/db.js',
  'js/store.js',
  'js/targets.js',
  'js/days.js',
  'js/week.js',
  'js/sync.js',
  'js/reminders.js',
  'js/drive.js',
  'js/foods.js',
  'js/ai.js',
  'js/charts.js',
  'js/calc.js',
  'js/ui/common.js',
  'js/ui/home.js',
  'js/ui/meals.js',
  'js/ui/body.js',
  'js/ui/activity.js',
  'js/ui/week.js',
  'js/ui/cloud.js',
  'js/ui/reminders.js',
  'js/ui/settings.js',
  'js/app.js',
];

// לא נשמרים במטמון אף פעם: AI, דרייב והתחברות לגוגל
const NEVER = ['api.anthropic.com', 'generativelanguage.googleapis.com', 'www.googleapis.com', 'accounts.google.com'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  // cache: 'reload' עוקף את מטמון הדפדפן, כדי שלא יתערבבו קבצים ישנים וחדשים
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'VERSION') e.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER.includes(url.hostname)) return;

  // גופנים: מהמטמון מיד, ועדכון ברקע
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // קבצי האפליקציה: קודם מהמטמון, ואם אין אז מהרשת
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return fetch(req);
    }),
  );
});

// לחיצה על התראה פותחת את האפליקציה
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return self.clients.openWindow('./');
  }));
});
