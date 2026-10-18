/**
 * Missions API SSE parsing helpers
 * @module sdk/client/missions-sse
 */

import { combineSignals, type TransportConfig } from './http-transport';
import { SophiaApiError } from './types';

export function parseMissionSseData(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseMissionSseLine(
  line: string,
  state: { currentEvent: string },
): { event: string; data: Record<string, unknown>; done: boolean } | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('event:')) {
    state.currentEvent = trimmed.slice(6).trim();
    return null;
  }
  if (!trimmed.startsWith('data:')) return null;
  const data = parseMissionSseData(trimmed);
  if (!data) return null;
  const event = state.currentEvent || 'message';
  return { event, data, done: state.currentEvent === 'done' || state.currentEvent === 'timeout' };
}

function createStreamSignal(
  config: TransportConfig,
  ro?: { timeoutMs?: number; signal?: AbortSignal },
): { signal: AbortSignal; timeoutId?: ReturnType<typeof setTimeout> } {
  const timeout = ro?.timeoutMs ?? config.timeoutMs;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Stream timeout after ${timeout}ms`));
    }, timeout);
  }

  const signal = ro?.signal
    ? combineSignals([ro.signal, controller.signal])
    : controller.signal;

  return { signal, timeoutId };
}

async function* readSseFrames(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    const state = { currentEvent: '' };
    for (const line of lines) {
      const parsed = parseMissionSseLine(line, state);
      if (!parsed) continue;
      yield { event: parsed.event, data: parsed.data };
      if (parsed.done) return;
    }
  }
}

export async function* streamMissionEvents(
  config: TransportConfig,
  id: string,
  ro?: { timeoutMs?: number; signal?: AbortSignal },
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const url = `${config.baseUrl}/api/v1/missions/${id}/stream`;
  const { signal, timeoutId } = createStreamSignal(config, ro);

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const resp = await fetch(url, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      signal,
    });

    if (!resp.ok || !resp.body) {
      throw new SophiaApiError(`Stream error ${resp.status}`, resp.status);
    }

    reader = resp.body.getReader();
    yield* readSseFrames(reader);
  } finally {
    reader?.releaseLock();
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}