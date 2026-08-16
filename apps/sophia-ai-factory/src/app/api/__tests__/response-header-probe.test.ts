import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';

describe('NextResponse.json header probing', () => {
  it('reads custom headers back via headers.get and headers.forEach', async () => {
    const resp = NextResponse.json(
      { ok: true },
      {
        status: 429,
        headers: {
          'Retry-After': '3600',
          'X-RateLimit-Remaining': '0',
          'cache-control': 'no-store',
          // mixed case: Next converts to lowercase internally
          'Content-Type': 'application/json',
        },
      },
    );

    expect(resp.status).toBe(429);

    const getEntries: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      getEntries[key.toLowerCase()] = value;
    });

    console.log('[ResponseHeader] headers accessed via forEach =', JSON.stringify(getEntries));

    expect(getEntries['retry-after']).toBeDefined();
    expect(getEntries['x-ratelimit-remaining']).toBeDefined();
    expect(getEntries['cache-control']).toBeDefined();
    expect(getEntries['content-type']).toBe('application/json');
  });
});