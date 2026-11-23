/**
 * Zero-network tripwire for offline benchmark tests and fixture runs.
 * Blocks every outbound globalThis.fetch call and records attempted URLs.
 *
 * @module land/eval/first-value-benchmark/zero-network-guard
 */

export interface ZeroNetworkGuardHandle {
  readonly blockedUrls: readonly string[];
  readonly restore: () => void;
}

function extractRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installBenchmarkZeroNetworkGuard(): ZeroNetworkGuardHandle {
  const originalFetch = globalThis.fetch;
  const blockedUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = extractRequestUrl(input);
    blockedUrls.push(url);
    throw new Error(`B4_ZERO_NETWORK_VIOLATION: outbound fetch blocked (${url})`);
  }) as typeof fetch;

  return {
    get blockedUrls(): readonly string[] {
      return [...blockedUrls];
    },
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
