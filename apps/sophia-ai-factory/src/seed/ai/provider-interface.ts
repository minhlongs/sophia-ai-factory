/**
 * @module seed/ai/provider-interface
 *
 * Abstract provider interface for Sophia AI Factory Phase 4.
 *
 * Generic enough for OpenAI-compatible APIs (OpenRouter, OpenAnthropic via
 * OpenRouter, local models) AND Anthropic Messages API (direct).
 *
 * All AI provider adapters (OpenRouter, Anthropic, ElevenLabs, WAN, Fish
 * Speech) implement this interface so the registry, router, and health
 * tracker can operate uniformly.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */


export type Complexity = 'simple' | 'medium' | 'complex'

// ── Provider identity ─────────────────────────────────────────────────────────

/**
 * Canonical provider identifiers.
 *
 * Each ID maps to one transport implementation.  `openrouter` is the
 * catch-all for any OpenAI-compatible API reached through the OpenRouter
 * gateway; `anthropic` is the direct Messages API.
 */
export type ProviderId = 'openrouter' | 'anthropic' | 'elevenlabs' | 'wan' | 'fish-speech';

// ── Message types ─────────────────────────────────────────────────────────────

/**
 * Normalised chat message — provider-agnostic.
 *
 * OpenAI uses `{ role, content }`; Anthropic Messages uses
 * `{ role, content: string | ContentBlock[] }`.  Adapters translate
 * both directions.
 */
export interface ChatMessage {
  /** `system` is allowed here so callers can express system prompts
   *  without depending on provider-specific param shapes. */
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Optional tool-call identifier (OpenAI function-call flow). */
  toolCallId?: string;
}

// ── Response types ────────────────────────────────────────────────────────────

/**
 * Successful completion response.
 */
export interface ChatResponse {
  /** The primary generated text. */
  content: string;
  /** Model that produced the response (e.g. `claude-sonnet-4-6`). */
  model: string;
  /** Provider that served the request. */
  provider: ProviderId;
  /** Token consumption breakdown. */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Normalised stop reason: `end_turn` | `max_tokens` | `tool_use` | `error`. */
  stopReason: string;
  /** Latency in milliseconds (measured by caller / adapter). */
  latencyMs: number;
  /** Raw provider response for debugging / audit. */
  raw?: Record<string, unknown>;
}

/**
 * A single chunk in a streaming response.
 *
 * OpenAI sends `delta` objects; Anthropic sends typed SSE events.
 * The union lets consumers handle both without provider branching.
 */
export type StreamChunk =
  | {
      type: 'text_delta';
      /** Accumulated text so far (OpenAI style). */
      delta: string;
      /** True when this is the final chunk. */
      done: boolean;
    }
  | {
      type: 'anthropic_event';
      /** Raw Anthropic SSE event name: `content_block_delta`,
       *  `message_start`, `message_stop`, etc. */
      event: string;
      /** Parsed event payload (varies by event type). */
      data: Record<string, unknown>;
      done: boolean;
    };

// ── Capabilities ──────────────────────────────────────────────────────────────

/**
 * What a provider/model combination supports.
 *
 * Filled in by the adapter at registration time from a static table
 * so callers can filter before issuing requests.
 */
export interface ProviderCapabilities {
  /** Whether the provider supports server-side streaming. */
  streaming: boolean;
  /** Whether the provider accepts a `system` role in the messages array. */
  systemRole: boolean;
  /** Maximum output tokens the model can produce in one call. */
  maxOutputTokens: number;
  /** Maximum input tokens (context window). */
  maxInputTokens: number;
  /** Whether the provider supports tool / function calling. */
  functionCalling: boolean;
  /** Whether the provider supports vision (image) inputs. */
  vision: boolean;
}

// ── Health ────────────────────────────────────────────────────────────────────

/**
 * Runtime health snapshot for a provider.
 *
 * Updated by `ProviderHealthTracker` after every request; read by
 * `ProviderRegistry` for fallback decisions.
 */
export interface ProviderHealth {
  /** Whether the provider is currently considered healthy. */
  healthy: boolean;
  /** Whether the provider is currently in cooldown after failures. */
  inCooldown: boolean;
  /** Cooldown expiry timestamp (epoch ms), if in cooldown. */
  cooldownUntil?: number;
  /** Rolling average request latency in ms. */
  avgLatencyMs: number;
  /** Timestamp of last successful request (epoch ms). */
  lastSuccess: number;
  /** Timestamp of last failed request (epoch ms). */
  lastFailure: number;
  /** Consecutive failures without an intervening success. */
  consecutiveFailures: number;
  /** Total requests observed since tracking started. */
  totalRequests: number;
  /** Total successful requests. */
  totalSuccesses: number;
  /** Total failed requests. */
  totalFailures: number;
}

// ── Chat options ──────────────────────────────────────────────────────────────

/**
 * Options passed to every `chat()` / `stream()` call.
 *
 * Adapters merge these with provider-specific params (apiVersion,
 * extra headers, etc.).
 */
export interface ChatOptions {
  /** Model identifier (provider-specific, e.g. `claude-sonnet-4-6`). */
  model: string;
  /** API key / bearer token.  Required unless the provider uses
   *  a different auth mechanism (e.g. signed URL). */
  apiKey: string;
  /** Base URL override — useful for OpenRouter gateway routing. */
  baseUrl?: string;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Sampling temperature (0 – 2). */
  temperature?: number;
  /** Top-p nucleus sampling. */
  topP?: number;
  /** Stop sequences. */
  stop?: string[];
  /** Seed for deterministic sampling (if provider supports it). */
  seed?: number;
  /** Request timeout in ms. */
  timeoutMs?: number;
  /** Extra headers (e.g. `x-stainless-raw-stream: true`). */
  extraHeaders?: Record<string, string>;
  /** Arbitrary provider-specific params forwarded as-is. */
  extraBody?: Record<string, unknown>;
  /** Structured output schema (JSON Schema) for providers that
   *  support constrained decoding. */
  responseFormat?: Record<string, unknown>;
}

// ── Provider interface ────────────────────────────────────────────────────────

/**
 * Abstract AI provider.
 *
 * Every AI service integration (OpenRouter, Anthropic, ElevenLabs, WAN,
 * Fish Speech) implements this interface.  The registry, health tracker,
 * and cost estimator operate exclusively against this contract.
 *
 * Implementations MUST NOT throw `MissingCredentialsError` for a missing
 * apiKey at construction time — they MAY throw at call time when the key
 * is actually needed, so that providers can be registered before their
 * credentials are configured (e.g. during tenant onboarding).
 */
export interface Provider {
  /** Stable provider identifier (matches the key used in the registry). */
  readonly id: ProviderId;

  /** Human-readable label for logs and UI. */
  readonly label: string;

  /**
   * Send a chat completion request and wait for the full response.
   *
   * @param messages — Normalised chat messages.
   * @param options — Model, credentials, and generation parameters.
   * @returns Complete response with content, usage, and metadata.
   * @throws {ProviderInvalidKeyError}   — apiKey is missing or rejected.
   * @throws {ProviderQuotaExceededError} — rate-limited or out of credits.
   * @throws {ProviderNetworkError}      — timeout, DNS failure, 5xx.
   */
  chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Promise<ChatResponse>;

  /**
   * Stream a chat completion, yielding chunks as they arrive.
   *
   * The generator MUST yield at least one chunk and MUST yield a final
   * chunk with `done: true` before completing (even on error — the
   * final chunk carries the error in `delta`).
   *
   * @param messages — Normalised chat messages.
   * @param options — Model, credentials, and generation parameters.
   * @yields StreamChunk — incremental response fragments.
   */
  stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Estimate the token count for a set of messages without sending
   * them to the provider.
   *
   * Used for cost estimation and context-window pre-checks.
   *
   * @param messages — Messages to count.
   * @param model — Model identifier (tokenisation differs by model).
   * @returns Estimated total token count.
   */
  countTokens(messages: ChatMessage[], model: string): number;

  /**
   * Estimate the USD cost for a request before sending it.
   *
   * @param messages — Messages that will be sent.
   * @param model — Model identifier.
   * @param options — Additional options that affect pricing
   *   (e.g. `maxTokens` for output cost projection).
   * @returns Estimated cost in USD.
   */
  estimateCost(
    messages: ChatMessage[],
    model: string,
    options?: ChatOptions,
  ): number;

  /**
   * Return the static capability profile for this provider/model.
   *
   * Capabilities are resolved at registration time from a static table
   * and do not change at runtime.
   */
  getCapabilities(model: string): ProviderCapabilities;
}
