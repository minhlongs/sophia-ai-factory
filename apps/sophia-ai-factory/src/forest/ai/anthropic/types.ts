/**
 * @module forest/ai/anthropic/types
 * Configuration and constants for the Anthropic provider adapter.
 */

export interface AnthropicProviderConfig {
  apiKey: string;
  label?: string;
}

export const API_URL = 'https://api.anthropic.com/v1/messages';
export const API_VERSION = '2023-06-01';
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TIMEOUT_MS = 120_000;
