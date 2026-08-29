/**
 * Mock Provider for Deterministic Testing
 *
 * Implements the seed Provider interface with fixed responses and deterministic
 * behavior. Used in tests to verify production graph execution without
 * calling real AI APIs.
 *
 * Layer: forest (reusable infrastructure)
 */
import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatResponse,
  ChatOptions,
  ProviderCapabilities,
  StreamChunk,
} from '@/seed/ai/provider-interface';
import { ProviderRegistry } from '@/seed/ai/provider-registry';

/** Mock provider configuration for deterministic test scenarios. */
export interface MockProviderConfig {
  /** Provider identifier (must be a valid ProviderId). */
  id: ProviderId;
  /** Human-readable label. */
  label: string;
  /** Fixed response content for all chat calls. */
  fixedResponse?: string;
  /** Fixed usage tokens. */
  fixedUsage?: { inputTokens: number; outputTokens: number };
  /** Fixed latency in milliseconds. */
  fixedLatencyMs?: number;
  /** Fixed model name. */
  fixedModel?: string;
  /** Whether to simulate failures. */
  shouldFail?: boolean;
  /** Error message when shouldFail is true. */
  errorMessage?: string;
  /** Seed for deterministic behavior (not used in mock but kept for API compatibility). */
  seed?: number;
}

/** Default mock configuration. */
const DEFAULT_CONFIG: MockProviderConfig = {
  id: 'openrouter',
  label: 'Mock Provider',
  fixedResponse: 'Mock response for deterministic testing',
  fixedUsage: { inputTokens: 100, outputTokens: 50 },
  fixedLatencyMs: 10,
  fixedModel: 'mock-model-v1',
};

/**
 * Create a mock provider with deterministic behavior.
 *
 * @param config - Configuration for the mock provider
 * @returns Provider implementation suitable for testing
 */
export function createMockProvider(config: Partial<MockProviderConfig> = {}): Provider {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const capabilities: ProviderCapabilities = {
    streaming: false,
    systemRole: true,
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    functionCalling: false,
    vision: false,
  };

  return {
    id: cfg.id,
    label: cfg.label,

    async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
      if (cfg.shouldFail) {
        const error = new Error(cfg.errorMessage ?? 'Mock provider configured to fail');
        error.name = 'ProviderError';
        throw error;
      }

      const response: ChatResponse = {
        content: cfg.fixedResponse ?? 'Mock response',
        model: cfg.fixedModel ?? options.model,
        provider: cfg.id,
        usage: cfg.fixedUsage ?? { inputTokens: 100, outputTokens: 50 },
        stopReason: 'end_turn',
        latencyMs: cfg.fixedLatencyMs ?? 10,
        raw: { mock: true, messagesCount: messages.length },
      };

      return response;
    },

    async *stream(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown> {
      if (cfg.shouldFail) {
        const errorChunk: StreamChunk = {
          type: 'text_delta',
          delta: `Error: ${cfg.errorMessage ?? 'Mock provider configured to fail'}`,
          done: true,
        };
        yield errorChunk;
        return;
      }

      const content = cfg.fixedResponse ?? 'Mock response';
      const chunk: StreamChunk = {
        type: 'text_delta',
        delta: content,
        done: true,
      };
      yield chunk;
    },

    countTokens(messages: ChatMessage[], _model: string): number {
      // Deterministic token count: 4 chars per token approximation
      const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
      return Math.ceil(totalChars / 4);
    },

    estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
      const inputTokens = this.countTokens(messages, model);
      const outputTokens = options?.maxTokens ?? 500;
      // Mock pricing: $0.001 per 1K tokens
      return (inputTokens + outputTokens) * 0.000001;
    },

    getCapabilities(model: string): ProviderCapabilities {
      return capabilities;
    },
  };
}

/**
 * Create a complete mock provider registry with multiple mock providers.
 *
 * Returns a ProviderRegistry pre-populated with healthy mock providers
 * for testing the full graph execution pipeline deterministically.
 */
export function createMockProviderRegistry(fallbackOrder: ProviderId[] = ['openrouter', 'anthropic']): {
  registry: ProviderRegistry;
  providers: Map<ProviderId, Provider>;
} {
  const registry = new ProviderRegistry(fallbackOrder);
  const providers = new Map<ProviderId, Provider>();

  // Create mock providers for each in fallback order
  for (const id of fallbackOrder) {
    const provider = createMockProvider({
      id,
      label: `Mock ${id}`,
      fixedResponse: `Mock response from ${id}`,
      fixedModel: `mock-${id}-v1`,
    });
    providers.set(id, provider);
    registry.register(provider);
  }

  return { registry, providers };
}

/**
 * Create a mock provider registry configured for a specific test scenario.
 */
export function createScenarioMockRegistry(scenario: 'success' | 'failure' | 'mixed'): {
  registry: ProviderRegistry;
  providers: Map<ProviderId, Provider>;
} {
  const registry = new ProviderRegistry(['openrouter', 'anthropic']);
  const providers = new Map<ProviderId, Provider>();

  if (scenario === 'success' || scenario === 'mixed') {
    const successProvider = createMockProvider({
      id: 'openrouter',
      label: 'Mock OpenRouter',
      fixedResponse: 'Success response',
      fixedModel: 'mock-success-v1',
    });
    providers.set('openrouter', successProvider);
    registry.register(successProvider);
  }

  if (scenario === 'failure' || scenario === 'mixed') {
    const failProvider = createMockProvider({
      id: 'anthropic',
      label: 'Mock Anthropic',
      shouldFail: true,
      errorMessage: 'Simulated provider failure',
      fixedModel: 'mock-fail-v1',
    });
    providers.set('anthropic', failProvider);
    registry.register(failProvider);
  }

  return { registry, providers };
}