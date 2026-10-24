// סנכרון לגוגל דרייב: הלוגיקה בלבד. drive ו-store מוזרקים מבחוץ
// drive: ensureFolder, ensureSubfolder, findFile, upload, list, remove, download (שגיאות: offline / auth / not-found)
// store: get, getMeta, setMeta, replace
(function (root) {
  const State = typeof require === 'function' ? require('./state.js') : root.State;
  const DATA = 'data.json';
  const BACKUPS = 'backups';
  const KEEP = 30;

  // השמות מתחילים בתאריך, ולכן מיון לפי שם הוא מיון לפי זמן
  function backupsToPrune(names, keep = KEEP) {
    const sorted = [...names].sort();
    return sorted.slice(0, Math.max(0, sorted.length - keep));
  }

  const needsBackup = (meta, today) => meta.lastBackupDate !== today;

  async function folderOf(drive, store) {
    return store.getMeta().driveFolderId || drive.ensureFolder();
  }

  async function attempt(drive, store, today) {
    const meta = store.getMeta();
    const backup = needsBackup(meta, today);
    if (!meta.dirty && !backup) return 'synced';

    const snapshot = store.get();
    const stamp = snapshot.updatedAt;
    const folder = await folderOf(drive, store);
    const existing = meta.dataFileId || (await drive.findFile(folder, DATA)) || undefined;
    const dataFileId = await drive.upload(folder, DATA, snapshot, existing);

    if (backup) {
      const bk = await drive.ensureSubfolder(folder, BACKUPS);
      await drive.upload(bk, `${today}.json`, snapshot);
      const files = await drive.list(bk);
      const prune = new Set(backupsToPrune(files.map(f => f.name)));
      for (const f of files) if (prune.has(f.name)) await drive.remove(f.id);
    }

    await store.setMeta({
      driveFolderId: folder,
      dataFileId,
      lastSyncAt: Date.now(),
      lastBackupDate: backup ? today : meta.lastBackupDate,
      // שינוי שקרה בזמן ההעלאה יסונכרן בפעם הבאה
      dirty: store.get().updatedAt !== stamp,
    });
    return 'synced';
  }

  // מחזיר 'synced' | 'offline' | 'auth' | 'error'
  async function run(drive, store, today) {
    try {
      try {
        return await attempt(drive, store, today);
      } catch (e) {
        // התיקייה או הקובץ נמחקו בדרייב: מתחילים מחדש פעם אחת
        if (e.message !== 'not-found') throw e;
        await store.setMeta({ driveFolderId: null, dataFileId: null });
        return await attempt(drive, store, today);
      }
    } catch (e) {
      if (e.message === 'offline' || e.message === 'auth') return e.message;
      return 'error';
    }
  }

  async function refresh(drive, store) {
    const folder = await folderOf(drive, store);
    const id = store.getMeta().dataFileId || (await drive.findFile(folder, DATA));
    if (!id) throw new Error('no-data');
    const data = await drive.download(id);
    if (!State.validate(data).ok) throw new Error('invalid');
    await store.replace(data);
    await store.setMeta({ driveFolderId: folder, dataFileId: id });
  }

  async function listBackups(drive, store) {
    const bk = await drive.ensureSubfolder(await folderOf(drive, store), BACKUPS);
    return (await drive.list(bk)).sort((a, b) => b.name.localeCompare(a.name));
  }

  // לפני שחזור נשמר גיבוי של המצב הנוכחי, כדי שאפשר יהיה לחזור
  async function restore(drive, store, fileId, today) {
    const data = await drive.download(fileId);
    if (!State.validate(data).ok) throw new Error('invalid');
    const bk = await drive.ensureSubfolder(await folderOf(drive, store), BACKUPS);
    await drive.upload(bk, `${today}-before-restore.json`, store.get());
    await store.replace(data);
    await store.setMeta({ dirty: true });
  }

  const Sync = { backupsToPrune, needsBackup, run, refresh, listBackups, restore };
  if (typeof module !== 'undefined') module.exports = Sync;
  else root.Sync = Sync;
})(this);
