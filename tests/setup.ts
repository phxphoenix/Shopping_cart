import '@testing-library/jest-dom';
import { vi } from 'vitest';

// JSDOM does not implement URL.createObjectURL/revokeObjectURL
if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }
}
