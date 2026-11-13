import { clear, createStore, del, entries, set } from 'idb-keyval';
import type { FileStore } from '../ports.js';
import type { FileData } from '../lib/types.js';

export function indexedDbFileStore(): FileStore {
  const db = createStore('styleguide', 'files');
  return {
    put: (path, data) => set(path, data, db),
    delete: (path) => del(path, db),
    clear: () => clear(db),
    getAll: async () => new Map(await entries<string, FileData>(db)),
  };
}
