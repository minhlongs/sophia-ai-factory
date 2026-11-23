/**
 * Zero-network tripwire for offline benchmark tests and fixture runs.
 * Blocks outbound network egress at both the Fetch API boundary (globalThis.fetch)
 * and the Node.js TCP socket runtime boundary (net.Socket.prototype.connect),
 * catching SDKs that bypass globalThis.fetch via node:http/node:https/undici.
 *
 * @module land/eval/first-value-benchmark/zero-network-guard
 */

import net from 'node:net';

export interface ZeroNetworkGuardHandle {
  readonly blockedUrls: readonly string[];
  readonly restore: () => void;
}

function extractRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function extractSocketTarget(args: readonly unknown[]): string {
  const first = args[0];
  if (first && typeof first === 'object') {
    const opts = first as { host?: string; port?: number; path?: string };
    if (opts.path) return `unix://${opts.path}`;
    return `tcp://${opts.host ?? 'localhost'}:${opts.port ?? 'unknown'}`;
  }
  if (typeof first === 'number') {
    const host = typeof args[1] === 'string' ? args[1] : 'localhost';
    return `tcp://${host}:${first}`;
  }
  if (typeof first === 'string') {
    return `unix://${first}`;
  }
  return 'tcp://unknown';
}

export function installBenchmarkZeroNetworkGuard(): ZeroNetworkGuardHandle {
  const originalFetch = globalThis.fetch;
  const originalSocketConnect = net.Socket.prototype.connect;
  const blockedUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = extractRequestUrl(input);
    blockedUrls.push(url);
    throw new Error(`B4_ZERO_NETWORK_VIOLATION: outbound fetch blocked (${url})`);
  }) as typeof fetch;

  net.Socket.prototype.connect = function blockedSocketConnect(...args: unknown[]): net.Socket {
    const target = extractSocketTarget(args);
    blockedUrls.push(target);
    throw new Error(`B4_ZERO_NETWORK_VIOLATION: outbound socket connect blocked (${target})`);
  } as typeof net.Socket.prototype.connect;

  return {
    get blockedUrls(): readonly string[] {
      return [...blockedUrls];
    },
    restore: () => {
      globalThis.fetch = originalFetch;
      net.Socket.prototype.connect = originalSocketConnect;
    },
  };
}
