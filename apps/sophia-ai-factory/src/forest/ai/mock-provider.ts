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

export {
  createMockProviderRegistry,
  createScenarioMockRegistry,
} from './mock-provider-registries';

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

    getCapabilities(_model: string): ProviderCapabilities {
      return capabilities;
    },
  };
}