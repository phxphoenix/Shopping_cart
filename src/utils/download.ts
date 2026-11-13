/**
 * Browser file download helper
 *
 * Triggers safe client-side file downloads without external libraries.
 */

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const hasCreateObjectURL =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const url = hasCreateObjectURL ? URL.createObjectURL(blob) : 'data:text/plain;charset=utf-8,';
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (anchor.parentNode) {
      document.body.removeChild(anchor);
    }
    if (hasCreateObjectURL && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }, 100);
}
