import type { SaveData } from '../GameState';

export const SAVE_KEY = 'sotw-save-v1';

/** The part of localStorage this game uses (so tests can supply a stand-in). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    const store = globalThis.localStorage;
    const probe = '__sotw_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    // Private browsing or blocked storage: the game still works, it just won't remember progress.
    return null;
  }
}

/** Saves and loads player progress on this device. */
export class ProgressStorage {
  constructor(private store: KeyValueStore | null = browserStore()) {}

  get available(): boolean {
    return this.store !== null;
  }

  load(): unknown {
    try {
      const raw = this.store?.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(data: SaveData): void {
    try {
      this.store?.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or blocked: ignore.
    }
  }

  clear(): void {
    try {
      this.store?.removeItem(SAVE_KEY);
    } catch {
      // Ignore.
    }
  }
}
