/**
 * Provider registry.
 *
 * The registry is an allow-list: a provider can only be used if an adapter was
 * compiled in **and** explicitly registered. The production instance is empty
 * and there is no code path that registers an adapter from configuration, so
 * setting `AI_PROVIDER` cannot enable AI or cause a network call.
 *
 * Tests construct their own registry with a fake provider. Nothing in `app.ts`
 * or `routes/` imports the fake, so it never ships in a production bundle.
 */

import type { AiAvailabilityReason } from '@quickbiz/shared';
import type { AppConfig } from '../config/env';
import { AiProviderError, type AiProvider } from './provider';

/** Lowercase identifier; matches the validation applied to `AI_PROVIDER`. */
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

export class AiProviderRegistry {
  readonly #providers = new Map<string, AiProvider>();

  /**
   * Register an adapter. Duplicate ids and malformed ids are rejected: a typo
   * in an id must fail at startup, not silently shadow an existing provider.
   */
  register(provider: AiProvider): void {
    if (!PROVIDER_ID_PATTERN.test(provider.id)) {
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

/**
 * The registry used by the running application.
 *
 * It is intentionally empty. Adding an adapter here is a reviewed code change,
 * not a configuration switch, and Stage 6 M1A forbids any real adapter.
 */
export const productionRegistry = new AiProviderRegistry();

export interface AiAvailability {
  readonly configured: boolean;
  readonly reason: AiAvailabilityReason;
  readonly requestedProvider: string | null;
  readonly model: string | null;
}

/**
 * Describe availability from the registry, never from configuration.
 *
 * `requestedProvider` is echoed for diagnostics. A name in configuration is a
 * preference, not proof that the feature works, so it cannot make `configured`
 * true.
 */
export function describeAiAvailability(
  config: AppConfig,
  registry: AiProviderRegistry = productionRegistry,
): AiAvailability {
  const registered = registry.list();
  const configured = registry.configured();

  const reason: AiAvailabilityReason =
    registered.length === 0
      ? 'no-adapters-registered'
      : configured.length === 0
        ? 'provider-not-configured'
        : 'ready';

  return {
    configured: configured.length > 0,
    reason,
    requestedProvider: config.ai.providerId,
    model: config.ai.model,
  };
}
