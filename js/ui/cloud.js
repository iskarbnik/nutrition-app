// סנכרון לדרייב: סמן בכותרת, סנכרון אוטומטי, וכרטיס בהגדרות
(() => {
  const DELAY = 5000;
  const LABELS = {
    syncing: 'מסנכרן...',
    synced: 'מסונכרן',
    offline: 'ממתין לאינטרנט',
    auth: 'צריך להתחבר מחדש',
    error: 'הסנכרון נכשל',
  };
  let status = 'off';
  let timer;

  const connected = () => !!Store.getMeta().driveConnected;

  function setStatus(s) {
    status = s;
    const badge = $('#sync-badge');
    badge.hidden = !connected();
    badge.textContent = LABELS[s] || '';
    badge.classList.toggle('bad', s === 'auth' || s === 'error' || s === 'offline');
    if (!$('[data-screen="settings"]').hidden) renderCard();
  }

  async function syncNow() {
    if (!connected()) return setStatus('off');
    if (!navigator.onLine) return setStatus('offline');
    if (!Drive.hasToken()) return setStatus('auth');
    setStatus('syncing');
    setStatus(await Sync.run(Drive, Store, today()));
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(syncNow, DELAY);
  }

  // חיבור ראשון במכשיר: אם כבר יש נתונים בדרייב, שואלים מה לעשות
  async function connect() {
    try {
      await Drive.connect(true);
    } catch (e) {
      UI.toast(e.message === 'offline' ? 'אין חיבור לאינטרנט' : 'ההתחברות לגוגל בוטלה או נכשלה');
      return;
    }
    const firstTime = !Store.getMeta().dataFileId;
    await Store.setMeta({ driveConnected: true });
    if (firstTime) {
      try {
        const folder = await Drive.ensureFolder();
        const remoteId = await Drive.findFile(folder, 'data.json');
        if (remoteId) return askWhichData(folder, remoteId);
      } catch { /* נמשיך לסנכרון רגיל */ }
    }
    await Store.setMeta({ dirty: true });
    syncNow();
  }

  function askWhichData(folder, remoteId) {
    const root = UI.sheet.open(`
      <h3 class="sheet-title">נמצאו נתונים בדרייב</h3>
      <p class="sheet-msg">בדרייב כבר יש נתונים של האפליקציה. באילו נתונים להשתמש?</p>
      <button type="button" class="btn primary" id="use-remote">בנתונים מהדרייב</button>
      <button type="button" class="btn" id="use-local">בנתונים שבטלפון</button>
      <p class="hint">בכל מקרה, הגיבויים הקודמים נשארים בדרייב.</p>`);
    $('#use-remote', root).addEventListener('click', async () => {
      await Store.setMeta({ driveFolderId: folder, dataFileId: remoteId });
      await doRefresh();
    });
    $('#use-local', root).addEventListener('click', async () => {
      await Store.setMeta({ driveFolderId: folder, dataFileId: remoteId, dirty: true });
      UI.sheet.close();
      syncNow();
    });
  }

  const ERR = {
    offline: 'אין חיבור לאינטרנט',
    auth: 'צריך להתחבר מחדש לגוגל',
    invalid: 'הקובץ בדרייב פגום. הנתונים בטלפון לא השתנו.',
    'no-data': 'אין עדיין נתונים בדרייב',
  };

  async function doRefresh() {
    try {
      await Sync.refresh(Drive, Store);
      UI.sheet.close();
      UI.toast('הנתונים נטענו מהדרייב');
      setStatus('synced');
    } catch (e) {
      UI.sheet.close();
      UI.toast(ERR[e.message] || 'הטעינה נכשלה');
    }
  }

  async function openRestore() {
    let list;
    try {
      list = await Sync.listBackups(Drive, Store);
    } catch (e) {
      return UI.toast(ERR[e.message] || 'לא הצלחתי לקרוא את הגיבויים');
    }
    const label = name => {
      const before = name.includes('before-restore');
      return formatDate(name.slice(0, 10)) + (before ? ' (לפני שחזור)' : '');
    };
    const root = UI.sheet.open(`
      <h3 class="sheet-title">שחזור מגיבוי</h3>
      <p class="hint">הנתונים בטלפון יוחלפו בגיבוי שנבחר. לפני כן נשמר גיבוי של המצב הנוכחי.</p>
      <div class="list">${list.map(f => `
        <div class="list-row"><div class="list-main"><span>${esc(label(f.name))}</span></div>
        <button type="button" class="chip-btn del" data-restore="${esc(f.id)}"></button></div>`).join('') || '<p class="hint">אין עדיין גיבויים.</p>'}</div>`);
    $$('[data-restore]', root).forEach(b => twoTap(b, async () => {
      try {
        await Sync.restore(Drive, Store, b.dataset.restore, today());
        UI.sheet.close();
        UI.toast('השחזור הושלם');
        syncNow();
      } catch (e) {
        UI.toast(ERR[e.message] || 'השחזור נכשל. הנתונים בטלפון לא השתנו.');
      }
    }, 'שחזור'));
  }

  function renderCard() {
    const configured = Drive.isConfigured();
    const on = connected();
    const meta = Store.getMeta();
    $('#drive-connect').hidden = on && Drive.hasToken();
    $('#drive-connect').textContent = on ? 'התחברות מחדש' : 'חיבור לגוגל דרייב';
    $('#drive-connect').disabled = !configured;
    $('#drive-actions').hidden = !(on && Drive.hasToken());
    let text;
    if (!configured) text = 'החיבור לגוגל עוד לא הוגדר באפליקציה (מזהה לקוח של Google חסר).';
    else if (!on) text = 'לא מחובר. הנתונים נשמרים רק בטלפון.';
    else if (!Drive.hasToken()) text = 'החיבור לגוגל פג. צריך להתחבר מחדש, הנתונים בטלפון בטוחים.';
    else text = `${LABELS[status] || 'מחובר'}${meta.lastSyncAt ? `. סנכרון אחרון: ${new Date(meta.lastSyncAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}` : ''}`;
    $('#drive-state').textContent = text;
  }

  function init() {
    window.addEventListener('state-changed', schedule);
    window.addEventListener('online', syncNow);
    window.addEventListener('offline', () => { if (connected()) setStatus('offline'); });
    $('#sync-badge').addEventListener('click', () => (status === 'auth' ? connect() : go('settings')));
    $('#drive-connect').addEventListener('click', connect);
    $('#drive-sync').addEventListener('click', async () => { await Store.setMeta({ dirty: true }); syncNow(); });
    twoTap($('#drive-refresh'), doRefresh, 'רענון מהדרייב');
    $('#drive-restore').addEventListener('click', openRestore);
    $('#drive-off').addEventListener('click', async () => {
      Drive.disconnect();
      await Store.setMeta({ driveConnected: false });
      setStatus('off');
      renderCard();
    });
    // בפתיחה: בלי חיבור פעיל, מסמנים שצריך להתחבר מחדש
    if (connected()) syncNow(); else setStatus('off');
  }

  Screens.cloud = { init, render: renderCard, syncNow };
})();
