/**
 * Provider Types, Message & Response Models
 *
 * Layer: seed/ai/provider
 */

export type Complexity = 'simple' | 'medium' | 'complex';

/**
 * Canonical provider identifiers.
 */
export type ProviderId = 'openrouter' | 'anthropic' | 'elevenlabs' | 'wan' | 'fish-speech';

/**
 * Normalised chat message — provider-agnostic.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

/**
 * Successful completion response.
 */
export interface ChatResponse {
  content: string;
  model: string;
  provider: ProviderId;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string;
  latencyMs: number;
  raw?: Record<string, unknown>;
}

/**
 * A single chunk in a streaming response.
 */
export type StreamChunk =
  | {
      type: 'text_delta';
      delta: string;
      done: boolean;
    }
  | {
      type: 'anthropic_event';
      event: string;
      data: Record<string, unknown>;
      done: boolean;
    };
