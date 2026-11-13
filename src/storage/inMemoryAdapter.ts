/**
 * Storage module: In-Memory Storage Adapter
 *
 * Provides a clean in-memory storage adapter for deterministic unit and integration tests.
 * Performs deep cloning to prevent reference mutations.
 */

import type { PersistedShopState } from '@/domain/schemas';
import type { StorageAdapter } from './adapter';

export class InMemoryStorageAdapter implements StorageAdapter {
  private state: PersistedShopState | null;

  constructor(initialState: PersistedShopState | null = null) {
    this.state = initialState ? JSON.parse(JSON.stringify(initialState)) : null;
  }

  async loadState(): Promise<PersistedShopState | null> {
    return this.state ? (JSON.parse(JSON.stringify(this.state)) as PersistedShopState) : null;
  }

  async saveState(state: PersistedShopState): Promise<void> {
    this.state = JSON.parse(JSON.stringify(state)) as PersistedShopState;
  }

  async clearState(): Promise<void> {
    this.state = null;
  }
}
