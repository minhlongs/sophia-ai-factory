/**
 * @module forest/ai/anthropic/types
 * Configuration, types and constants for the Anthropic provider adapter and messages API.
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
export const ERROR_BODY_MAX_LEN = 500;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface CallAnthropicParams {
  model: string;
  messages: AnthropicMessage[];
  apiKey: string;
  maxTokens?: number;
  tools?: AnthropicTool[];
  system?: string;
}
