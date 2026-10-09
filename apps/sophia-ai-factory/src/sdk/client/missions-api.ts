/**
 * Sophia Client SDK Missions API
 *
 * Layer: sdk
 */

import {
  type CreateMissionOptions,
  type ListMissionsOptions,
  type Mission,
  type MissionEvent,
  type PaginatedMissions,
  type RequestOptions,
  SophiaApiError,
} from './types';
import { combineSignals, type TransportConfig } from './http-transport';

export async function* streamMissionEvents(
  config: TransportConfig,
  id: string,
  ro?: RequestOptions,
): AsyncGenerator<MissionEvent> {
  const url = `${config.baseUrl}/api/v1/missions/${id}/stream`;
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

  try {
    const resp = await fetch(url, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      signal,
    });

    if (!resp.ok || !resp.body) {
      throw new SophiaApiError(`Stream error ${resp.status}`, resp.status);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            try {
              const data = JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
              yield { event: currentEvent || 'message', data };
              if (currentEvent === 'done' || currentEvent === 'timeout') return;
            } catch {
              // Skip malformed data line
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function createMissionsApi(
  config: TransportConfig,
  request: <T>(path: string, options?: RequestInit, ro?: RequestOptions) => Promise<T>,
) {
  const streamEvents = (id: string, ro?: RequestOptions) => streamMissionEvents(config, id, ro);

  return {
    create: async (opts: CreateMissionOptions, ro?: RequestOptions): Promise<Mission> => {
      return request<Mission>('/api/v1/missions', {
        method: 'POST',
        body: JSON.stringify(opts),
      }, ro);
    },

    get: async (id: string, ro?: RequestOptions): Promise<Mission> => {
      return request<Mission>(`/api/v1/missions/${id}`, {}, ro);
    },

    stream: streamEvents,
    streamEvents,

    list: async (opts?: ListMissionsOptions, ro?: RequestOptions): Promise<PaginatedMissions> => {
      const params = new URLSearchParams();
      if (opts?.status) params.set('status', opts.status);
      if (opts?.command) params.set('command', opts.command);
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.cursor) params.set('cursor', opts.cursor);
      const qs = params.toString();
      return request<PaginatedMissions>(`/api/v1/missions${qs ? `?${qs}` : ''}`, {}, ro);
    },
  };
}
