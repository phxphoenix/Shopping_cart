import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as idb from 'idb-keyval';
import {
  DEFAULT_STORAGE_KEY,
  IndexedDbStorageAdapter,
  isIndexedDbAvailable,
  isLocalStorageAvailable,
} from '@/storage/indexedDbAdapter';
import { InMemoryStorageAdapter } from '@/storage/inMemoryAdapter';
import { createSeedState } from '@/storage/seed';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, val: unknown) => {
      store.set(key, val);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

describe('storage/indexedDbAdapter', () => {
  const originalIndexedDB = globalThis.indexedDB;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Enable indexedDB mock in jsdom
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {} as IDBFactory,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: originalIndexedDB,
      writable: true,
      configurable: true,
    });
  });

  describe('isIndexedDbAvailable & isLocalStorageAvailable', () => {
    it('detects available storage mechanisms in test environment', () => {
      expect(typeof isIndexedDbAvailable()).toBe('boolean');
      expect(typeof isLocalStorageAvailable()).toBe('boolean');
    });
  });

  describe('IndexedDbStorageAdapter', () => {
    it('saves and loads valid state via IndexedDB', async () => {
      const adapter = new IndexedDbStorageAdapter('test_key');
      const seed = createSeedState();

      await adapter.saveState(seed);
      expect(idb.set).toHaveBeenCalledWith('test_key', seed);

      const loaded = await adapter.loadState();
      expect(loaded).toEqual(seed);
    });

    it('falls back to localStorage when IndexedDB read rejects', async () => {
      const adapter = new IndexedDbStorageAdapter('fallback_key');
      const seed = createSeedState();

      // Put state in localStorage
      localStorage.setItem('fallback_key', JSON.stringify(seed));

      // Make idb.get reject
      vi.mocked(idb.get).mockRejectedValueOnce(new Error('IndexedDB blocked'));

      const loaded = await adapter.loadState();
      expect(loaded).toEqual(seed);
    });

    it('returns null safely when stored data is corrupted or invalid schema', async () => {
      const adapter = new IndexedDbStorageAdapter('corrupted_key');

      // Put invalid JSON in localStorage
      localStorage.setItem('corrupted_key', '{ not valid json');

      vi.mocked(idb.get).mockResolvedValueOnce(null);

      const loaded = await adapter.loadState();
      expect(loaded).toBeNull();
    });

    it('returns null safely when stored object violates Zod schema', async () => {
      const adapter = new IndexedDbStorageAdapter('invalid_schema_key');

      // Invalid schema (version is 1 instead of 2, missing customers)
      vi.mocked(idb.get).mockResolvedValueOnce({
        version: 1,
        broken: true,
      });

      const loaded = await adapter.loadState();
      expect(loaded).toBeNull();
    });

    it('clears state in both IndexedDB and localStorage', async () => {
      const adapter = new IndexedDbStorageAdapter(DEFAULT_STORAGE_KEY);
      localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(createSeedState()));

      await adapter.clearState();

      expect(idb.del).toHaveBeenCalledWith(DEFAULT_STORAGE_KEY);
      expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
    });

    it('throws error when attempting to save invalid state', async () => {
      const adapter = new IndexedDbStorageAdapter();
      // @ts-expect-error deliberately passing invalid state
      await expect(adapter.saveState({ invalid: true })).rejects.toThrow(
        /Invalid state passed to saveState/
      );
    });
  });

  describe('InMemoryStorageAdapter', () => {
    it('stores and retrieves state independently in memory with deep cloning', async () => {
      const adapter = new InMemoryStorageAdapter();
      expect(await adapter.loadState()).toBeNull();

      const seed = createSeedState();
      await adapter.saveState(seed);

      const loaded = await adapter.loadState();
      expect(loaded).toEqual(seed);

      // Verify deep cloning (mutating seed doesn't mutate adapter state)
      (seed.customers as unknown as Array<{ name: string }>)[0]!.name = 'MUTATED';
      const loadedAgain = await adapter.loadState();
      expect(loadedAgain?.customers[0]?.name).toBe('Jan Kowalski');

      await adapter.clearState();
      expect(await adapter.loadState()).toBeNull();
    });
  });
});
