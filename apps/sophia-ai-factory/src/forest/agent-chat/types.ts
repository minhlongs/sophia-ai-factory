/**
 * Agent Chat — Shared Types
 *
 * ChatMessage, ChatContext, SseEvent used across
 * API route, stream-formatter, and client-side hook.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** Extracted <think> block, populated on assistant messages */
  reasoning?: string;
}

export interface ChatContext {
  currentPage?: string;
  installationId?: string;
  locale?: string;
}

export type SseEvent =
  | { type: 'token'; data: string }
  | { type: 'reasoning'; data: string }
  | { type: 'tool_call'; data: { id: string; name: string; args: Record<string, unknown> } }
  | { type: 'tool_result'; data: { id: string; name: string; success: boolean; content: string | Record<string, unknown>; error?: string } }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface LlmRoute {
  provider: 'local' | 'deepseek' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}
