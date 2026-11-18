/**
 * File download helpers.
 *
 * Everything is generated in the browser: no document ever leaves the device,
 * which is both a privacy decision and the reason the tools work offline.
 */

export function canDownloadFiles(): boolean {
  return typeof URL.createObjectURL === 'function';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Revoke after the browser has committed the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function downloadBytes(
  bytes: Uint8Array<ArrayBuffer>,
  filename: string,
  mimeType = 'application/pdf',
): void {
  triggerDownload(new Blob([bytes], { type: mimeType }), filename);
}

export function downloadText(
  text: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  triggerDownload(new Blob([text], { type: mimeType }), filename);
}
