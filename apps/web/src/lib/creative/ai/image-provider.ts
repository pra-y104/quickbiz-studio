/**
 * AI image generation — contract and empty registry.
 *
 * Deliberately separate from the text provider contract. Images have a different
 * input (prompt, optional reference image), a different output (binary), different
 * abuse cases and a different cost profile, so they must not share a call path.
 *
 * In this build:
 *
 * - `AI_IMAGE_ENABLED` is `false`,
 * - `PRODUCTION_IMAGE_ADAPTERS` is empty and module-local,
 * - `productionImageRegistry` is a frozen object with no `register` method,
 * - nothing here can reach a network, a key or a paid API.
 *
 * The design engine has no import from this module or from `ai/`, so image
 * generation can never become a dependency of editing, saving or exporting.
 */

export type AiImageErrorCode =
  | 'not-configured'
  | 'timeout'
  | 'cancelled'
  | 'rate-limited'
  | 'blocked'
  | 'invalid-response'
  | 'upstream';

export interface AiImageRequest {
  readonly prompt: string;
  /** Document pixel size of the requested output. */
  readonly width: number;
  readonly height: number;
  readonly signal?: AbortSignal;
}

export interface AiImageResult {
  /** Opaque bytes owned by the caller; the adapter never returns a URL. */
  readonly bytes: Uint8Array;
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly width: number;
  readonly height: number;
}

export interface AiImageProvider {
  readonly id: string;
  readonly label: string;
  /** Capability, not intent: true only with a usable credential present. */
  isConfigured(): boolean;
  generate(request: AiImageRequest): Promise<AiImageResult>;
}

export class AiImageProviderError extends Error {
  readonly code: AiImageErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(code: AiImageErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AiImageProviderError';
    this.code = code;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ReadonlyAiImageRegistry {
  get(id: string): AiImageProvider | undefined;
  list(): readonly AiImageProvider[];
  configured(): readonly AiImageProvider[];
}

/** Adapters approved for production. Empty: no image provider is funded or approved. */
const PRODUCTION_IMAGE_ADAPTERS: readonly AiImageProvider[] = [];

function seal(registry: ReadonlyAiImageRegistry): ReadonlyAiImageRegistry {
  return Object.freeze({
    get: (id: string) => registry.get(id),
    list: () => registry.list(),
    configured: () => registry.configured(),
  });
}

function buildRegistry(): ReadonlyAiImageRegistry {
  const providers = [...PRODUCTION_IMAGE_ADAPTERS];
  return seal({
    get: (id) => providers.find((provider) => provider.id === id),
    list: () => [...providers],
    configured: () => providers.filter((provider) => provider.isConfigured()),
  });
}

export const productionImageRegistry: ReadonlyAiImageRegistry = buildRegistry();

export interface AiImageAvailability {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly reason:
    'feature-disabled' | 'no-adapters-registered' | 'provider-not-configured' | 'ready';
}

export function describeImageAvailability(enabled: boolean): AiImageAvailability {
  if (!enabled) return { enabled: false, configured: false, reason: 'feature-disabled' };
  if (productionImageRegistry.list().length === 0) {
    return { enabled: true, configured: false, reason: 'no-adapters-registered' };
  }
  const ready = productionImageRegistry.configured().length > 0;
  return {
    enabled: true,
    configured: ready,
    reason: ready ? 'ready' : 'provider-not-configured',
  };
}
