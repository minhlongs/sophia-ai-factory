/**
 * /api/version — public payload + Cache-Control + admin introspection gate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/version', { headers });
}

const ENV_KEYS = ['COMMIT_SHA', 'DEPLOYED_AT', 'DEPLOY_BRANCH', 'INTROSPECT_TOKEN'] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
  process.env.COMMIT_SHA = 'abcdef1234567890';
  process.env.DEPLOYED_AT = '2026-05-11T05:00:00Z';
  process.env.DEPLOY_BRANCH = 'main';
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k]!;
  }
});

describe('GET /api/version', () => {
  it('returns public payload with shortSha + deployedAt', async () => {
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { shortSha: string; deployedAt: string };
    expect(body.shortSha).toBe('abcdef12');
    expect(body.deployedAt).toBe('2026-05-11T05:00:00Z');
  });

  it('sets Cache-Control on the public response', async () => {
    const resp = await GET(buildRequest());
    const cc = resp.headers.get('cache-control');
    expect(cc).toMatch(/public/);
    expect(cc).toMatch(/s-maxage=60/);
    expect(cc).toMatch(/stale-while-revalidate/);
  });

  it('omits commitSha + branch from the public payload', async () => {
    const resp = await GET(buildRequest());
    const body = (await resp.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('commitSha');
    expect(body).not.toHaveProperty('branch');
  });

  it('returns full payload when Bearer token matches INTROSPECT_TOKEN', async () => {
    process.env.INTROSPECT_TOKEN = 'topsecret';
    const resp = await GET(buildRequest({ authorization: 'Bearer topsecret' }));
    const body = (await resp.json()) as { commitSha: string; branch: string };
    expect(body.commitSha).toBe('abcdef1234567890');
    expect(body.branch).toBe('main');
  });

  it('admin response is NOT cached (no Cache-Control header)', async () => {
    process.env.INTROSPECT_TOKEN = 'topsecret';
    const resp = await GET(buildRequest({ authorization: 'Bearer topsecret' }));
    expect(resp.headers.get('cache-control')).toBeNull();
  });

  it('falls back to public when Bearer token does not match', async () => {
    process.env.INTROSPECT_TOKEN = 'topsecret';
    const resp = await GET(buildRequest({ authorization: 'Bearer wrong' }));
    const body = (await resp.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('commitSha');
  });
});
