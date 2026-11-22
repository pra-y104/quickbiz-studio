/**
 * Webhook signature verification.
 *
 * Two formats are supported so the caller is not tied to one provider:
 *
 * - a plain hex HMAC-SHA256 of the raw body (Paystack's \`x-paystack-signature\`);
 * - a timestamped \`t=…,v1=…\` header (the common Stripe-style shape).
 *
 * Rules:
 *
 * - the **raw** body bytes are signed; re-serialising JSON changes the signature;
 * - comparison is constant-time to avoid leaking the expected value by timing;
 * - timestamped signatures outside the tolerance window are rejected as replays.
 *
 * No provider secret is logged, echoed or included in an error message.
 */

export type SignatureFormat = 'hex' | 'tagged';

export interface SignatureInput {
  readonly secret: string;
  readonly rawBody: string;
  readonly signature: string | null;
  readonly timestamp?: string | null;
  readonly toleranceSeconds?: number;
  readonly now?: number;
}

export type SignatureFailure = 'missing' | 'malformed' | 'mismatch' | 'stale';

export type SignatureResult =
  { readonly valid: true } | { readonly valid: false; readonly reason: SignatureFailure };

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[index] = byte;
  }
  return bytes;
}

/** Constant-time comparison of two equal-length byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return new Uint8Array(signature);
}

function parseTagged(header: string): { timestamp: string; signature: string } | null {
  const parts = new Map<string, string>();
  for (const part of header.split(',')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    parts.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

export async function verifySignature(input: SignatureInput): Promise<SignatureResult> {
  const header = input.signature?.trim() ?? '';
  if (header.length === 0) return { valid: false, reason: 'missing' };

  const tagged = header.includes('=') ? parseTagged(header) : null;
  const providedHex = tagged?.signature ?? header;
  const provided = hexToBytes(providedHex);
  if (!provided) return { valid: false, reason: 'malformed' };

  if (tagged) {
    const tolerance = input.toleranceSeconds ?? 300;
    const timestampSeconds = Number(tagged.timestamp);
    const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
    if (!Number.isFinite(timestampSeconds)) return { valid: false, reason: 'malformed' };
    if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
      return { valid: false, reason: 'stale' };
    }
  }

  const signedPayload = tagged ? `${tagged.timestamp}.${input.rawBody}` : input.rawBody;
  const expected = await hmac(input.secret, signedPayload);

  return timingSafeEqual(expected, provided)
    ? { valid: true }
    : { valid: false, reason: 'mismatch' };
}
