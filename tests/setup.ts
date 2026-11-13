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

// JSDOM does not implement File.prototype.text / Blob.prototype.text
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
if (typeof File !== 'undefined' && !File.prototype.text) {
  File.prototype.text = Blob.prototype.text;
}
