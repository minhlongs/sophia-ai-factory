/**
 * Shared setup for POST/GET /api/support/tickets route tests.
 *
 * Provides vi.hoisted mocks, vi.mock registrations, dynamic route import,
 * request factory, and beforeEach reset. Imported by route.test.ts.
 */

import { vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const _mocks = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();

  const chainResult: { data: unknown; error: unknown } = { data: null, error: null };
  const setChainResult = (data: unknown, error: unknown): void => {
    chainResult.data = data;
    chainResult.error = error;
  };

  let throwNext = false;
  const throwOnNextAwait = (shouldThrow: boolean): void => {
    throwNext = shouldThrow;
  };
  const getThrowNext = (): boolean => throwNext;

  return { mockGetCurrentUser, chainResult, setChainResult, throwOnNextAwait, getThrowNext };
});

export const {
  mockGetCurrentUser,
  chainResult,
  setChainResult,
  throwOnNextAwait,
  getThrowNext,
} = _mocks;

// ── Mock registrations ──────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => {
  function createChainable(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: unknown, onrejected?: unknown) => {
        const p = getThrowNext()
          ? Promise.reject(new Error('DB insert failed'))
          : Promise.resolve({ data: chainResult.data, error: chainResult.error });
        return (p as Promise<unknown>).then(
          onfulfilled as (v: unknown) => unknown,
          typeof onrejected === 'function' ? onrejected as (e: unknown) => unknown : undefined,
        );
      }),
    };
    return chain;
  }

  const mockFrom = vi.fn(() => createChainable());

  return {
    createServerClient: vi.fn(() => ({ from: mockFrom })),
  };
});

// ── Route import (after mocks are registered) ───────────────────────────────

export const { POST, GET } = await import('../route');

// ── Request factory ─────────────────────────────────────────────────────────

export function makeReq(
  method: string,
  url: string,
  body?: Record<string, unknown>,
): NextRequest {
  const opts: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(url, opts);
}

// ── Per-test reset ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetCurrentUser.mockReset();
  setChainResult(null, null);
  throwOnNextAwait(false);
});
