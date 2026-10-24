const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../js/state.js');
const Sync = require('../js/sync.js');

const TODAY = '2026-10-24';

// דרייב מדומה בזיכרון
function fakeDrive() {
  let n = 0;
  const files = new Map(); // id -> { name, parent, data, folder }
  const d = {
    files,
    fail: null, // 'offline' | 'auth'
    calls: [],
    check() { if (d.fail) throw new Error(d.fail); },
    async ensureFolder() { d.check(); return d.mkdir('root', 'תזונה ומשקל'); },
    async ensureSubfolder(parent, name) { d.check(); return d.mkdir(parent, name); },
    mkdir(parent, name) {
      for (const [id, f] of files) if (f.folder && f.parent === parent && f.name === name) return id;
      const id = 'f' + ++n;
      files.set(id, { name, parent, folder: true });
      return id;
    },
    async findFile(parent, name) {
      d.check();
      for (const [id, f] of files) if (!f.folder && f.parent === parent && f.name === name) return id;
      return null;
    },
    async upload(parent, name, data, fileId) {
      d.check();
      d.calls.push(name);
      if (fileId) {
        if (!files.has(fileId)) throw new Error('not-found');
        files.get(fileId).data = JSON.parse(JSON.stringify(data));
        return fileId;
      }
      if (!files.has(parent)) throw new Error('not-found');
      const id = 'x' + ++n;
      files.set(id, { name, parent, data: JSON.parse(JSON.stringify(data)) });
      return id;
    },
    async list(parent) {
      d.check();
      return [...files].filter(([, f]) => f.parent === parent && !f.folder).map(([id, f]) => ({ id, name: f.name }));
    },
    async remove(id) { d.check(); files.delete(id); },
    async download(id) { d.check(); if (!files.has(id)) throw new Error('not-found'); return JSON.parse(JSON.stringify(files.get(id).data)); },
  };
  d.files.set('root', { name: 'root', folder: true });
  return d;
}

function fakeStore(state = State.empty(), meta = {}) {
  let st = state;
  let m = { dirty: true, lastSyncAt: 0, lastBackupDate: null, driveFolderId: null, dataFileId: null, ...meta };
  return {
    get: () => st,
    getMeta: () => m,
    setMeta: async patch => { m = { ...m, ...patch }; },
    replace: async next => { st = State.migrate(next); m = { ...m, dirty: false }; },
  };
}

const fileNamed = (drive, name) => [...drive.files.values()].find(f => f.name === name);

test('backupsToPrune keeps the newest 30', () => {
  const names = Array.from({ length: 32 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}.json`.replace('2026-09-31', '2026-10-01').replace('2026-09-32', '2026-10-02'));
  const prune = Sync.backupsToPrune(names, 30);
  assert.deepEqual(prune, ['2026-09-01.json', '2026-09-02.json']);
});

test('backupsToPrune counts before-restore copies with their date', () => {
  const names = ['2026-10-02.json', '2026-10-01-before-restore.json', '2026-10-01.json'];
  assert.deepEqual(Sync.backupsToPrune(names, 2), ['2026-10-01-before-restore.json']);
});

test('needsBackup once per day', () => {
  assert.equal(Sync.needsBackup({ lastBackupDate: null }, TODAY), true);
  assert.equal(Sync.needsBackup({ lastBackupDate: TODAY }, TODAY), false);
});

test('run uploads data.json and one daily backup, then clears dirty', async () => {
  const drive = fakeDrive();
  const store = fakeStore();
  assert.equal(await Sync.run(drive, store, TODAY), 'synced');
  assert.ok(fileNamed(drive, 'data.json'));
  assert.ok(fileNamed(drive, `${TODAY}.json`));
  assert.equal(store.getMeta().dirty, false);
  assert.equal(store.getMeta().lastBackupDate, TODAY);

  store.get().profile.name = 'שינוי';
  await store.setMeta({ dirty: true });
  await Sync.run(drive, store, TODAY);
  assert.equal(drive.calls.filter(c => c === `${TODAY}.json`).length, 1);
  assert.equal(fileNamed(drive, 'data.json').data.profile.name, 'שינוי');
});

test('run while offline keeps dirty so the next launch syncs', async () => {
  const drive = fakeDrive();
  drive.fail = 'offline';
  const store = fakeStore();
  assert.equal(await Sync.run(drive, store, TODAY), 'offline');
  assert.equal(store.getMeta().dirty, true);
});

test('run with expired sign-in reports auth and keeps dirty', async () => {
  const drive = fakeDrive();
  drive.fail = 'auth';
  const store = fakeStore();
  assert.equal(await Sync.run(drive, store, TODAY), 'auth');
  assert.equal(store.getMeta().dirty, true);
});

test('a change made during upload stays dirty', async () => {
  const drive = fakeDrive();
  const store = fakeStore();
  const upload = drive.upload;
  drive.upload = async (...a) => { store.get().updatedAt = 999; return upload(...a); };
  await Sync.run(drive, store, TODAY);
  assert.equal(store.getMeta().dirty, true);
});

test('run recovers when the Drive folder or file was deleted', async () => {
  const drive = fakeDrive();
  const store = fakeStore(State.empty(), { driveFolderId: 'gone', dataFileId: 'gone2', lastBackupDate: TODAY });
  assert.equal(await Sync.run(drive, store, TODAY), 'synced');
  assert.ok(fileNamed(drive, 'data.json'));
  assert.notEqual(store.getMeta().driveFolderId, 'gone');
});

test('run prunes old backups', async () => {
  const drive = fakeDrive();
  const folder = await drive.ensureFolder();
  const backups = await drive.ensureSubfolder(folder, 'backups');
  for (let i = 1; i <= 30; i++) await drive.upload(backups, `2026-09-${String(i).padStart(2, '0')}.json`, {});
  await Sync.run(drive, fakeStore(), TODAY);
  const names = (await drive.list(backups)).map(f => f.name);
  assert.equal(names.length, 30);
  assert.ok(!names.includes('2026-09-01.json'));
  assert.ok(names.includes(`${TODAY}.json`));
});

test('refresh replaces local data with data.json', async () => {
  const drive = fakeDrive();
  const remote = State.empty();
  remote.profile.name = 'מהדרייב';
  await Sync.run(drive, fakeStore(remote), TODAY);
  const local = fakeStore();
  await Sync.refresh(drive, local);
  assert.equal(local.get().profile.name, 'מהדרייב');
});

test('restore with an invalid file throws and leaves data untouched', async () => {
  const drive = fakeDrive();
  const store = fakeStore();
  store.get().profile.name = 'מקומי';
  await Sync.run(drive, store, TODAY);
  const backups = await drive.ensureSubfolder(await drive.ensureFolder(), 'backups');
  const bad = await drive.upload(backups, '2026-10-01.json', { hello: 1 });
  await assert.rejects(Sync.restore(drive, store, bad, TODAY), { message: 'invalid' });
  assert.equal(store.get().profile.name, 'מקומי');
  assert.ok(!fileNamed(drive, `${TODAY}-before-restore.json`));
});

test('restore saves the current state first, then replaces and marks dirty', async () => {
  const drive = fakeDrive();
  const old = State.empty();
  old.profile.name = 'ישן';
  await Sync.run(drive, fakeStore(old), '2026-10-01');
  const backups = await drive.ensureSubfolder(await drive.ensureFolder(), 'backups');
  const [oldBackup] = await drive.list(backups);

  const store = fakeStore();
  store.get().profile.name = 'נוכחי';
  await Sync.restore(drive, store, oldBackup.id, TODAY);
  assert.equal(fileNamed(drive, `${TODAY}-before-restore.json`).data.profile.name, 'נוכחי');
  assert.equal(store.get().profile.name, 'ישן');
  assert.equal(store.getMeta().dirty, true);
});

test('listBackups is newest first', async () => {
  const drive = fakeDrive();
  const backups = await drive.ensureSubfolder(await drive.ensureFolder(), 'backups');
  for (const d of ['2026-10-02', '2026-10-05', '2026-10-01']) await drive.upload(backups, `${d}.json`, {});
  const list = await Sync.listBackups(drive, fakeStore());
  assert.deepEqual(list.map(b => b.name), ['2026-10-05.json', '2026-10-02.json', '2026-10-01.json']);
});

test('run does nothing while the user has not chosen which data to keep', async () => {
  const drive = fakeDrive();
  const store = fakeStore(State.empty(), { pendingChoice: true });
  assert.equal(await Sync.run(drive, store, TODAY), 'pending');
  assert.equal(drive.calls.length, 0);
});

test('concurrent runs do not overlap and the second change still syncs', async () => {
  const drive = fakeDrive();
  const store = fakeStore();
  const runner = Sync.serial();
  const a = runner(drive, store, TODAY);
  store.get().profile.name = 'אחרי';
  store.get().updatedAt = 5;
  await store.setMeta({ dirty: true });
  const b = runner(drive, store, TODAY);
  await Promise.all([a, b]);
  const dataFiles = [...drive.files.values()].filter(f => f.name === 'data.json');
  assert.equal(dataFiles.length, 1);
  assert.equal(dataFiles[0].data.profile.name, 'אחרי');
  assert.equal([...drive.files.values()].filter(f => f.name === 'backups').length, 1);
});
