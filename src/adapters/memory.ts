import type { FileStore, KeyValueStore } from '../ports.js';
import type { FileData } from '../lib/types.js';

export function memoryKeyValueStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

export function memoryFileStore(): FileStore {
  const files = new Map<string, FileData>();
  return {
    async put(path, data) {
      files.set(path, data);
    },
    delete: async (path) => files.delete(path),
    clear: async () => files.clear(),
    getAll: async () => new Map(files),
  };
}
