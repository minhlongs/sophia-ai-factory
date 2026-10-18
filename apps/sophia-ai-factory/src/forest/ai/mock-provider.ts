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
  id: ProviderId;
  label: string;
  fixedResponse?: string;
  fixedUsage?: { inputTokens: number; outputTokens: number };
  fixedLatencyMs?: number;
  fixedModel?: string;
  shouldFail?: boolean;
  errorMessage?: string;
  seed?: number;
}

const DEFAULT_CONFIG: MockProviderConfig = {
  id: 'openrouter',
  label: 'Mock Provider',
  fixedResponse: 'Mock response for deterministic testing',
  fixedUsage: { inputTokens: 100, outputTokens: 50 },
  fixedLatencyMs: 10,
  fixedModel: 'mock-model-v1',
};

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  streaming: false,
  systemRole: true,
  maxOutputTokens: 4096,
  maxInputTokens: 32768,
  functionCalling: false,
  vision: false,
};

/**
 * Create a mock provider with deterministic behavior.
 */
export function createMockProvider(config: Partial<MockProviderConfig> = {}): Provider {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    id: cfg.id,
    label: cfg.label,

    async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
      if (cfg.shouldFail) {
        const error = new Error(cfg.errorMessage ?? 'Mock provider configured to fail');
        error.name = 'ProviderError';
        throw error;
      }

      return {
        content: cfg.fixedResponse ?? 'Mock response',
        model: cfg.fixedModel ?? options.model,
        provider: cfg.id,
        usage: cfg.fixedUsage ?? { inputTokens: 100, outputTokens: 50 },
        stopReason: 'end_turn',
        latencyMs: cfg.fixedLatencyMs ?? 10,
        raw: { mock: true, messagesCount: messages.length },
      };
    },

    async *stream(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown> {
      if (cfg.shouldFail) {
        yield {
          type: 'text_delta',
          delta: `Error: ${cfg.errorMessage ?? 'Mock provider configured to fail'}`,
          done: true,
        };
        return;
      }

      yield {
        type: 'text_delta',
        delta: cfg.fixedResponse ?? 'Mock response',
        done: true,
      };
    },

    countTokens(messages: ChatMessage[], _model: string): number {
      const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
      return Math.ceil(totalChars / 4);
    },

    estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
      const inputTokens = this.countTokens(messages, model);
      const outputTokens = options?.maxTokens ?? 500;
      return (inputTokens + outputTokens) * 0.000001;
    },

    getCapabilities(_model: string): ProviderCapabilities {
      return DEFAULT_CAPABILITIES;
    },
  };
}