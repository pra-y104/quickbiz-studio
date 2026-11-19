/**
 * Provider registry.
 *
 * The registry is an allow-list: a provider can only be used if an adapter was
 * compiled in **and** explicitly registered.
 *
 * Production registration is local to this module. `productionRegistry` exposes
 * a frozen, read-only view, so no other file can add an adapter to the running
 * application even if it imports the singleton. A future adapter is added to
 * `PRODUCTION_ADAPTERS` in a reviewed change to this file and nowhere else.
 */

import { AI_PROVIDER_ID_PATTERN, type AiAvailabilityReason } from '@quickbiz/shared';
import type { AppConfig } from '../config/env';
import { AiProviderError, type AiProvider } from './provider';

/** The only operations the rest of the application may perform. */
export interface ReadonlyAiProviderRegistry {
  get(id: string): AiProvider | undefined;
  list(): readonly AiProvider[];
  configured(): readonly AiProvider[];
  require(id: string): AiProvider;
}

export class AiProviderRegistry implements ReadonlyAiProviderRegistry {
  readonly #providers = new Map<string, AiProvider>();

  /**
   * Register an adapter. Duplicate ids and malformed ids are rejected: a typo
   * in an id must fail at startup, not silently shadow an existing provider.
   */
  register(provider: AiProvider): void {
    if (!AI_PROVIDER_ID_PATTERN.test(provider.id)) {
      throw new Error(`Invalid AI provider id: ${provider.id}`);
    }
    if (this.#providers.has(provider.id)) {
      throw new Error(`AI provider already registered: ${provider.id}`);
    }
    this.#providers.set(provider.id, provider);
  }

  get(id: string): AiProvider | undefined {
    return this.#providers.get(id);
  }

  list(): readonly AiProvider[] {
    return [...this.#providers.values()];
  }

  /** Adapters that report a usable credential. Empty in this build. */
  configured(): readonly AiProvider[] {
    return this.list().filter((provider) => provider.isConfigured());
  }

  /**
   * Fail closed: no provider, or a provider without a credential, is an error
   * the caller must handle. It never falls back to another provider.
   */
  require(id: string): AiProvider {
    const provider = this.#providers.get(id);
    if (!provider || !provider.isConfigured()) {
      throw new AiProviderError('not-configured', 'No AI provider is configured.');
    }
    return provider;
  }
}

/** Drop the mutable surface so a read-only handle cannot register anything. */
function sealRegistry(registry: AiProviderRegistry): ReadonlyAiProviderRegistry {
  return Object.freeze({
    get: (id: string) => registry.get(id),
    list: () => registry.list(),
    configured: () => registry.configured(),
    require: (id: string) => registry.require(id),
  });
}

/**
 * Adapters approved for production, in registration order.
 *
 * Empty in Stage 6 M1A: adding a real adapter is a reviewed code change in M1B.
 */
const PRODUCTION_ADAPTERS: readonly AiProvider[] = [];

function buildProductionRegistry(): ReadonlyAiProviderRegistry {
  const registry = new AiProviderRegistry();
  for (const adapter of PRODUCTION_ADAPTERS) registry.register(adapter);
  return sealRegistry(registry);
}

/**
 * The registry used by the running application.
 *
 * Its type has no `register` method, and the instance returned to callers is a
 * frozen object with only the read operations. M1A adds no adapter.
 */
export const productionRegistry: ReadonlyAiProviderRegistry = buildProductionRegistry();

export interface AiAvailability {
  readonly configured: boolean;
  readonly reason: AiAvailabilityReason;
  readonly requestedProvider: string | null;
  readonly model: string | null;
}

/**
 * Describe availability from the registry, never from configuration.
 *
 * When a provider is requested, it must be registered *and* configured for the
 * feature to be reported as ready; a different configured adapter cannot make
 * the requested one look available. Without a request, any configured adapter is
 * enough.
 */
export function describeAiAvailability(
  config: AppConfig,
  registry: ReadonlyAiProviderRegistry = productionRegistry,
): AiAvailability {
  const requested = config.ai.providerId;

  const base = {
    requestedProvider: requested,
    model: config.ai.model,
  } as const;

  if (registry.list().length === 0) {
    return { configured: false, reason: 'no-adapters-registered', ...base };
  }

  const ready =
    requested === null
      ? registry.configured().length > 0
      : registry.get(requested)?.isConfigured() === true;

  return {
    configured: ready,
    reason: ready ? 'ready' : 'provider-not-configured',
    ...base,
  };
}
