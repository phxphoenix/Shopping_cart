import { describe, expect, it } from 'vitest';
import * as storeModule from '@/store';

describe('store/index', () => {
  it('exports createShopStore and useShopStore', () => {
    expect(typeof storeModule.createShopStore).toBe('function');
    expect(typeof storeModule.useShopStore).toBe('function');
    expect(typeof storeModule.useShopStore.getState).toBe('function');
  });
});
