import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  Complexity,
} from '../provider-interface';
import type { ProviderRegistry } from '../provider-registry';

export interface RoutedChatResult {
  response: ChatResponse;
  providerId: ProviderId;
  complexity: Complexity;
  usedFallback: boolean;
  estimatedCost: number;
  attempts: number;
}

export interface MultiProviderRouterOptions {
  registry: ProviderRegistry;
  primaryProvider: ProviderId;
  fallbackProvider: ProviderId;
  maxFallbackAttempts?: number;
  logCost?: boolean;
}

export class AllProvidersFailedError extends Error {
  readonly attempts: number;
  readonly lastProviderId: ProviderId;
  readonly lastError: Error;

  constructor(attempts: number, lastProviderId: ProviderId, lastError: Error) {
    super(`All ${attempts} provider(s) failed. Last: ${lastProviderId} — ${lastError.message}`);
    this.name = 'AllProvidersFailedError';
    this.attempts = attempts;
    this.lastProviderId = lastProviderId;
    this.lastError = lastError;
  }
}

export type StreamResultChunk = StreamChunk & {
  providerId?: ProviderId;
  usedFallback?: boolean;
};

export type { ProviderId, ChatMessage, ChatOptions, ChatResponse, StreamChunk, Complexity };
