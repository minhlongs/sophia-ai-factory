/**
 * Sophia Client SDK HTTP Transport
 *
 * Layer: sdk
 */

import { type RequestOptions, SophiaApiError } from './types';

export function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

export interface TransportConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export async function executeHttpRequest<T>(
  config: TransportConfig,
  path: string,
  options?: RequestInit,
  ro?: RequestOptions,
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const timeout = ro?.timeoutMs ?? config.timeoutMs;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);
  }

  const signal = ro?.signal
    ? combineSignals([ro.signal, controller.signal])
    : controller.signal;

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    authHeaders.Authorization = `Bearer ${config.apiKey}`;
  }

  try {
    const resp = await fetch(url, {
      ...options,
      signal,
      headers: {
        ...authHeaders,
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (!resp.ok) {
      let errorBody: string;
      try {
        errorBody = await resp.text();
      } catch {
        errorBody = '<failed to read response body>';
      }
      throw new SophiaApiError(
        `Sophia API error ${resp.status}: ${errorBody.slice(0, 300)}`,
        resp.status,
        errorBody,
      );
    }

    return (await resp.json()) as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
