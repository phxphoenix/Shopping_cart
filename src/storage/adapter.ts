/**
 * Storage module: Storage Adapter Interface
 *
 * Defines the contract for persistent storage operations (IndexedDB, localStorage, InMemory).
 * Operates strictly on versioned PersistedShopState (v2).
 */

import type { PersistedShopState } from '@/domain/schemas';

export interface StorageAdapter {
  /**
   * Loads persisted shop state from storage.
   * Returns null if storage is empty or contains unrecoverable data.
   */
  loadState(): Promise<PersistedShopState | null>;

  /**
   * Persists the given state to storage.
   */
  saveState(state: PersistedShopState): Promise<void>;

  /**
   * Clears persisted shop state from storage.
   */
  clearState(): Promise<void>;
}
