/** Generate a stable-enough id for a video project, clip or asset. */
export function createVideoId(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // Fallback for older runtimes without randomUUID.
  const random = Math.random().toString(36).slice(2, 10);
  return `vid_${Date.now().toString(36)}_${random}`;
}
