/**
 * Provider Chat Options
 *
 * Layer: seed/ai/provider
 */

/**
 * Options passed to every chat() / stream() call.
 */
export interface ChatOptions {
  /** Model identifier (provider-specific, e.g. claude-sonnet-4-6). */
  model: string;
  /** API key / bearer token. */
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
  /** Seed for deterministic sampling. */
  seed?: number;
  /** Request timeout in ms. */
  timeoutMs?: number;
  /** Extra headers. */
  extraHeaders?: Record<string, string>;
  /** Arbitrary provider-specific params forwarded as-is. */
  extraBody?: Record<string, unknown>;
  /** Structured output schema (JSON Schema). */
  responseFormat?: Record<string, unknown>;
}
