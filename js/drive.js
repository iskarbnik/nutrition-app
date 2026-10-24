// חיבור לגוגל דרייב מהדפדפן: התחברות עם Google Identity Services וקריאות REST
// הרשאת drive.file: האפליקציה רואה רק קבצים שהיא יצרה
(function (root) {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const FOLDER_NAME = 'תזונה ומשקל';

  let token = null;
  let expiry = 0;
  let gisPromise = null;

  function loadGis() {
    if (!gisPromise) {
      gisPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload = resolve;
        s.onerror = () => { gisPromise = null; reject(new Error('offline')); };
        document.head.appendChild(s);
      });
    }
    return gisPromise;
  }

  const hasToken = () => !!token && Date.now() < expiry - 60000;
  const tokenInfo = () => ({ token, expiry });
  // חיבור שנשמר בטלפון (עד שעה), כדי שפתיחה מחדש של האפליקציה לא תדרוש התחברות
  function useToken(info) {
    if (info && info.token && info.expiry > Date.now()) { token = info.token; expiry = info.expiry; }
  }
  const preload = () => loadGis().catch(() => {});
  const isConfigured = () => !!(root.Config && root.Config.GOOGLE_CLIENT_ID);

  // interactive=true רק מתוך לחיצה של המשתמש (אחרת הדפדפן חוסם את החלון)
  async function connect(interactive) {
    if (hasToken()) return token;
    if (!interactive) throw new Error('auth');
    await loadGis();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: root.Config.GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: r => {
          if (r.error || !r.access_token) return reject(new Error('auth'));
          token = r.access_token;
          expiry = Date.now() + Number(r.expires_in || 3600) * 1000;
          resolve(token);
        },
        error_callback: () => reject(new Error('auth')),
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  function disconnect() {
    if (token && root.google && google.accounts) google.accounts.oauth2.revoke(token, () => {});
    token = null;
    expiry = 0;
  }

  async function req(url, opts = {}) {
    if (!hasToken()) throw new Error('auth');
    let res;
    try {
      res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    } catch {
      throw new Error('offline');
    }
    if (res.status === 401) { token = null; throw new Error('auth'); }
    if (res.status === 404) throw new Error('not-found');
    if (!res.ok) throw new Error('drive-failed');
    return res;
  }

  const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function query(where) {
    const url = `${API}?q=${encodeURIComponent(where + ' and trashed=false')}&fields=files(id,name)&pageSize=200&spaces=drive`;
    return (await (await req(url)).json()).files || [];
  }

  async function mkdir(name, parent) {
    const body = { name, mimeType: FOLDER_MIME };
    if (parent) body.parents = [parent];
    const res = await req(`${API}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()).id;
  }

  async function ensureFolder() {
    const found = await query(`name='${q(FOLDER_NAME)}' and mimeType='${FOLDER_MIME}'`);
    return found.length ? found[0].id : mkdir(FOLDER_NAME);
  }

  async function ensureSubfolder(parent, name) {
    const found = await query(`name='${q(name)}' and mimeType='${FOLDER_MIME}' and '${parent}' in parents`);
    return found.length ? found[0].id : mkdir(name, parent);
  }

  async function findFile(parent, name) {
    const found = await query(`name='${q(name)}' and '${parent}' in parents`);
    return found.length ? found[0].id : null;
  }

  async function upload(parent, name, data, fileId) {
    const boundary = 'nutrition' + Date.now();
    const meta = fileId ? { name } : { name, parents: [parent], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
    const url = fileId ? `${UPLOAD}/${fileId}?uploadType=multipart&fields=id` : `${UPLOAD}?uploadType=multipart&fields=id`;
    const res = await req(url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return (await res.json()).id;
  }

  const list = parent => query(`'${parent}' in parents and mimeType!='${FOLDER_MIME}'`);

  async function remove(id) {
    await req(`${API}/${id}`, { method: 'DELETE' });
  }

  async function download(id) {
    const res = await req(`${API}/${id}?alt=media`);
    try { return await res.json(); } catch { throw new Error('invalid'); }
  }

  root.Drive = { isConfigured, hasToken, tokenInfo, useToken, preload, connect, disconnect, ensureFolder, ensureSubfolder, findFile, upload, list, remove, download };
})(this);
