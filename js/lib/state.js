// The editor's state: the brand document, session files, autosave and the previous draft.
const DRAFT = 'styleguide:draft';
const PREVIOUS = 'styleguide:previous';
const BASE = 'styleguide:base';

const read = (storage, key) => {
  try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return null; }
};

export function createStore({ doc, storage, fileStore }) {
  let base = read(storage, BASE) ?? doc;
  let current = read(storage, DRAFT) ?? base;
  let timer = null;
  const subs = new Set();
  const files = new Map();

  const store = {
    files,
    saveError: null,
    get: () => current,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    set(next) {
      current = next;
      clearTimeout(timer);
      timer = setTimeout(store.flush, 300);
      for (const fn of subs) fn(current);
    },
    update: (fn) => store.set(fn(current)),
    flush() {
      clearTimeout(timer);
      try {
        storage.setItem(DRAFT, JSON.stringify(current));
        store.saveError = null;
      } catch (e) {
        store.saveError = e;
      }
    },
    load(next, newFiles) {
      storage.setItem(PREVIOUS, JSON.stringify(current));
      base = next;
      storage.setItem(BASE, JSON.stringify(base));
      if (newFiles) store.addFiles(newFiles);
      store.set(next);
      store.flush();
    },
    hasPrevious: () => storage.getItem(PREVIOUS) !== null,
    // Swaps the current draft and the previous one, so a restore can itself be undone.
    restorePrevious() {
      const prev = read(storage, PREVIOUS);
      if (!prev) return false;
      storage.setItem(PREVIOUS, JSON.stringify(current));
      store.set(prev);
      store.flush();
      return true;
    },
    clearDraft() {
      clearTimeout(timer);
      storage.setItem(PREVIOUS, JSON.stringify(current));
      storage.removeItem(DRAFT);
      current = base;
      for (const fn of subs) fn(current);
    },
    // Session files always land in memory; persistence can fail (quota) and is reported.
    async addFiles(map) {
      const notPersisted = [];
      for (const [path, data] of map) files.set(path, data);
      for (const fn of subs) fn(current);
      for (const [path, data] of map) {
        try { await fileStore.put(path, data); } catch { notPersisted.push(path); }
      }
      return { notPersisted };
    },
  };

  store.ready = fileStore.getAll().then((saved) => {
    for (const [p, data] of saved) if (!files.has(p)) files.set(p, data);
  }).catch(() => {});
  return store;
}

// Browser only: session files in IndexedDB (localStorage is too small for images and fonts).
export function idbFileStore() {
  const db = new Promise((res, rej) => {
    const req = indexedDB.open('styleguide', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const run = (mode, fn) => db.then((d) => new Promise((res, rej) => {
    const tx = d.transaction('files', mode);
    const out = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(out?.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  }));
  return {
    put: (path, data) => run('readwrite', (s) => s.put(data, path)),
    delete: (path) => run('readwrite', (s) => s.delete(path)),
    clear: () => run('readwrite', (s) => s.clear()),
    getAll: () => db.then((d) => new Promise((res, rej) => {
      const out = new Map();
      const req = d.transaction('files').objectStore('files').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return res(out);
        out.set(c.key, c.value);
        c.continue();
      };
      req.onerror = () => rej(req.error);
    })),
  };
}
