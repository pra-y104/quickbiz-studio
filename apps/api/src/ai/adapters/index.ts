/**
 * Adapter selection.
 *
 * Builds the provider registry from configuration. An adapter is registered only
 * when it is *configured*, and "configured" always means two things: a usable
 * credential is present **and** the deployment has explicitly set
 * `AI_ENABLED=true`. A key on its own can never start billable traffic.
 *
 * Supported today:
 *   * `gemini` — Google Generative Language (AI Studio key);
 *   * `openai` / `groq` / `openrouter` / any Chat-Completions-compatible gateway
 *     via `AI_OPENAI_BASE_URL` + `AI_OPENAI_MODEL`.
 *
 * No adapter performs a network call at registration time.
 */

import type { AppConfig, Bindings } from '../../config/env';
import { createGeminiAdapter } from './gemini';
import { createOpenAICompatibleAdapter } from './openai-compatible';
import { AiProviderRegistry, type ReadonlyAiProviderRegistry } from '../registry';
import type { AiProvider } from '../provider';

export interface AdapterBuildResult {
  readonly registry: ReadonlyAiProviderRegistry;
  /** Ids that were considered, for diagnostics (never the key). */
  readonly considered: readonly string[];
}

function buildAdapters(bindings: Bindings, config: AppConfig): AiProvider[] {
  const enabled = bindings.AI_ENABLED === 'true';
  const adapters: AiProvider[] = [];

  const gemini = createGeminiAdapter({
    apiKey: bindings.GEMINI_API_KEY?.trim() || bindings.AI_API_KEY?.trim() || null,
    enabled,
    ...(bindings.AI_MODEL ? { defaultModel: bindings.AI_MODEL } : {}),
  });
  if (gemini.isConfigured()) adapters.push(gemini);

  const openAiBase = bindings.AI_OPENAI_BASE_URL?.trim();
  if (openAiBase) {
    const compatible = createOpenAICompatibleAdapter({
      id: bindings.AI_OPENAI_PROVIDER_ID?.trim() || 'openai',
      label: bindings.AI_OPENAI_LABEL?.trim() || 'OpenAI-compatible provider',
      apiKey: bindings.AI_OPENAI_API_KEY?.trim() || null,
      enabled,
      baseUrl: openAiBase,
      defaultModel: bindings.AI_OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    });
    if (compatible.isConfigured()) adapters.push(compatible);
  }

  // A requested provider that is not configured must not silently fall back to a
  // different one: the caller asked for a specific model.
  void config;
  return adapters;
}

export function buildAdapterRegistry(bindings: Bindings, config: AppConfig): AdapterBuildResult {
  const registry = new AiProviderRegistry();
  const adapters = buildAdapters(bindings, config);
  for (const adapter of adapters) registry.register(adapter);

  return {
    registry: Object.freeze({
      get: (id: string) => registry.get(id),
      list: () => registry.list(),
      configured: () => registry.configured(),
      require: (id: string) => registry.require(id),
    }),
    considered: ['gemini', 'openai-compatible'],
  };
}
