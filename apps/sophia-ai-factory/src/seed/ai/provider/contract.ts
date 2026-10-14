/**
 * Provider Abstract Contract Interface
 *
 * Layer: seed/ai/provider
 */

import type {
  ChatMessage,
  ChatResponse,
  ProviderId,
  StreamChunk,
} from './types';
import type { ProviderCapabilities } from './health';
import type { ChatOptions } from './options';

/**
 * Abstract AI provider.
 *
 * Every AI service integration (OpenRouter, Anthropic, ElevenLabs, WAN,
 * Fish Speech) implements this interface.
 */
export interface Provider {
  /** Stable provider identifier. */
  readonly id: ProviderId;

  /** Human-readable label for logs and UI. */
  readonly label: string;

  /**
   * Send a chat completion request and wait for the full response.
   */
  chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Promise<ChatResponse>;

  /**
   * Stream a chat completion, yielding chunks as they arrive.
   */
  stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Estimate the token count for a set of messages.
   */
  countTokens(messages: ChatMessage[], model: string): number;

  /**
   * Estimate the USD cost for a request before sending it.
   */
  estimateCost(
    messages: ChatMessage[],
    model: string,
    options?: ChatOptions,
  ): number;

  /**
   * Return the static capability profile for this provider/model.
   */
  getCapabilities(model: string): ProviderCapabilities;
}
