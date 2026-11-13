/**
 * Storage module: IndexedDB Storage Adapter with localStorage Fallback
 *
 * Implements persistent storage using `idb-keyval` with graceful, safe fallback
 * to `localStorage` when IndexedDB is unavailable (private browsing, sandboxed iframes, test envs).
 * Strictly validates data with Zod (PersistedShopStateSchema) upon reading.
 */

import { PersistedShopStateSchema, type PersistedShopState } from '@/domain/schemas';
import { del, get, set } from 'idb-keyval';
import type { StorageAdapter } from './adapter';

export const DEFAULT_STORAGE_KEY = 'shopping_cart_retro_v2';

export function isIndexedDbAvailable(): boolean {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.indexedDB !== 'undefined' &&
      globalThis.indexedDB !== null
    );
  } catch {
    return false;
  }
}

export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) {
      return false;
    }
    const probe = '__storage_probe__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  constructor(private readonly key: string = DEFAULT_STORAGE_KEY) {}

  /**
   * Loads persisted shop state, attempting IndexedDB first, then localStorage.
   * Returns null if state is missing or fails Zod validation.
   */
  async loadState(): Promise<PersistedShopState | null> {
    // 1. Attempt IndexedDB read
    if (isIndexedDbAvailable()) {
      try {
        const idbData = await get<unknown>(this.key);
        if (idbData !== undefined && idbData !== null) {
          const parsed = PersistedShopStateSchema.safeParse(idbData);
          if (parsed.success) {
            return parsed.data;
          }
          // If corrupted in IDB, try falling back to localStorage
        }
      } catch {
        // IDB operation threw or rejected (e.g. SecurityError in private mode)
      }
    }

    // 2. Attempt localStorage fallback
    if (isLocalStorageAvailable()) {
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) {
          const json = JSON.parse(raw);
          const parsed = PersistedShopStateSchema.safeParse(json);
          if (parsed.success) {
            return parsed.data;
          }
        }
      } catch {
        // JSON parse error or storage error
      }
    }

    return null;
  }

  /**
   * Persists shop state to both IndexedDB and localStorage when available.
   */
  async saveState(state: PersistedShopState): Promise<void> {
    const validated = PersistedShopStateSchema.safeParse(state);
    if (!validated.success) {
      throw new Error(
        `Invalid state passed to saveState: ${validated.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    let saved = false;

    if (isIndexedDbAvailable()) {
      try {
        await set(this.key, validated.data);
        saved = true;
      } catch {
        // Fall back to localStorage
      }
    }

    if (isLocalStorageAvailable()) {
      try {
        localStorage.setItem(this.key, JSON.stringify(validated.data));
        saved = true;
      } catch {
        // Ignore if IDB succeeded, otherwise will remain unsaved
      }
    }

    if (!saved && !isIndexedDbAvailable() && !isLocalStorageAvailable()) {
      // Both storage mechanisms unavailable; non-fatal in volatile environments
    }
  }

  /**
   * Clears persisted shop state from both IndexedDB and localStorage.
   */
  async clearState(): Promise<void> {
    if (isIndexedDbAvailable()) {
      try {
        await del(this.key);
      } catch {
        // Ignore IDB delete errors
      }
    }

    if (isLocalStorageAvailable()) {
      try {
        localStorage.removeItem(this.key);
      } catch {
        // Ignore localStorage remove errors
      }
    }
  }
}
