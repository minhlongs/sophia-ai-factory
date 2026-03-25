/**
 * Claude Engine — Centralized convenience wrapper around LLM Router.
 *
 * Adds: structured system prompt management, JSON output parsing,
 * token usage tracking, and convenience methods for common patterns.
 */

import { llmGenerate, chatCompletion, type ChatMessage } from './llm-router';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClaudeEngineOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ClaudeEngineResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
  provider: string;
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Generate text with structured system prompt.
 */
export async function generateWithClaude(opts: ClaudeEngineOptions): Promise<string> {
  return llmGenerate(opts.prompt, {
    system: opts.system,
    maxTokens: opts.maxTokens ?? 4096,
    jsonMode: opts.jsonMode,
  });
}

/**
 * Generate text and return full usage metadata.
 */
export async function generateWithClaudeDetailed(
  opts: ClaudeEngineOptions,
): Promise<ClaudeEngineResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.prompt },
  ];

  const result = await chatCompletion({
    messages,
    maxTokens: opts.maxTokens ?? 4096,
    jsonMode: opts.jsonMode,
  });

  return {
    content: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs: result.durationMs,
    model: result.model,
    provider: result.provider,
  };
}

/**
 * Generate and parse JSON response.
 * Returns null on parse failure — callers should use fallback.
 */
export async function generateJsonWithClaude<T>(opts: ClaudeEngineOptions): Promise<T | null> {
  const raw = await generateWithClaude({ ...opts, jsonMode: true });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Generate and parse a JSON array response.
 * Returns null on parse failure — callers should use fallback.
 */
export async function generateJsonArrayWithClaude<T>(
  opts: ClaudeEngineOptions,
): Promise<T[] | null> {
  const raw = await generateWithClaude({ ...opts, jsonMode: true });
  try {
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]) as T[];
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;
    const parsed = JSON.parse(objMatch[0]) as Record<string, unknown>;
    const firstArray = Object.values(parsed).find(Array.isArray);
    return firstArray ? (firstArray as T[]) : null;
  } catch {
    return null;
  }
}
