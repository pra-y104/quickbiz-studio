/**
 * Provider-independent AI interface.
 *
 * Stage 2 defines the contract only. No provider is registered and no network
 * call is made anywhere in this build, so it is impossible for the app to
 * present fabricated "AI" output. Stage 6 adds concrete adapters (Gemini first,
 * behind owner approval) plus credit reservation in the API layer.
 */
export interface AiMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface AiGenerationRequest {
  readonly system?: string;
  readonly messages: readonly AiMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface AiGenerationResult {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly latencyMs: number;
}

export interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  /** True only when the server holds a usable key for this provider. */
  isConfigured(): boolean;
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}

export class AiProviderUnavailableError extends Error {
  constructor(message = 'No AI provider is configured.') {
    super(message);
    this.name = 'AiProviderUnavailableError';
  }
}

export class ProviderRegistry {
  readonly #providers = new Map<string, AiProvider>();

  register(provider: AiProvider): void {
    this.#providers.set(provider.id, provider);
  }

  get(id: string): AiProvider | undefined {
    return this.#providers.get(id);
  }

  list(): AiProvider[] {
    return [...this.#providers.values()];
  }

  /** Providers with a usable key. Empty in Stage 2 by design. */
  configured(): AiProvider[] {
    return this.list().filter((provider) => provider.isConfigured());
  }

  require(id: string): AiProvider {
    const provider = this.get(id);
    if (!provider || !provider.isConfigured()) {
      throw new AiProviderUnavailableError();
    }
    return provider;
  }
}

export const providerRegistry = new ProviderRegistry();
