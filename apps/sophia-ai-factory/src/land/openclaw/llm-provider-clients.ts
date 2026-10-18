/**
 * LLM Provider HTTP clients (Qwen local + Anthropic direct) with circuit breaker protection.
 */

import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
  reset as resetCircuit,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export const QWEN_SERVICE = 'qwen-local';
export const ANTHROPIC_SERVICE = 'anthropic-direct';

export function _resetCircuit(): void {
  resetCircuit(QWEN_SERVICE);
  resetCircuit(ANTHROPIC_SERVICE);
}

export async function callQwen(
  prompt: string,
  baseUrl: string,
  timeoutMs: number,
  circuitEnabled: boolean,
): Promise<string> {
  if (circuitEnabled && !shouldAllowRequest(QWEN_SERVICE)) {
    throw new Error('Circuit open for qwen-local');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:32b',
        prompt: `You must respond in English only. Never respond in Chinese.\n\n${prompt}`,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
    const data = (await res.json()) as { response?: string };
    recordSuccess(QWEN_SERVICE);
    return data.response ?? '';
  } catch (err) {
    recordFailure(QWEN_SERVICE, classifyError(err));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function callClaude(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  if (!shouldAllowRequest(ANTHROPIC_SERVICE)) {
    throw new Error('Circuit open for anthropic-direct');
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = (await res.json()) as { content?: { text?: string }[] };
    recordSuccess(ANTHROPIC_SERVICE);
    return data.content?.[0]?.text ?? '';
  } catch (err) {
    recordFailure(ANTHROPIC_SERVICE, classifyError(err));
    throw err;
  }
}
