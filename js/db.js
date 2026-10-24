// IndexedDB: שתי טבלאות פשוטות של מפתח-ערך
// kv: הנתונים ומצב הסנכרון. secrets: מפתחות AI (לא עולים לדרייב)
(function (root) {
  const NAME = 'nutrition-app';
  let dbPromise;

  const OPEN_TIMEOUT = 3000; // יש דפדפנים שבהם הפתיחה לא עונה בכלל

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('db-timeout')), OPEN_TIMEOUT);
        const req = indexedDB.open(NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('kv');
          req.result.createObjectStore('secrets');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  const DB = {
    get: (store, key) => run(store, 'readonly', s => s.get(key)),
    put: (store, key, value) => run(store, 'readwrite', s => s.put(value, key)),
    del: (store, key) => run(store, 'readwrite', s => s.delete(key)),
  };
  root.DB = DB;
})(this);
