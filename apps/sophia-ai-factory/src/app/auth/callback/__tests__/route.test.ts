import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/auth/callback/route';
import {
  PRODUCTION_TECHNICAL_HOSTNAME,
  PRODUCTION_TECHNICAL_ORIGIN,
  resetDynamicHostRegistryForTests,
} from '@/seed/domain';

describe('GET /auth/callback', () => {
  beforeEach(() => {
    resetDynamicHostRegistryForTests();
  });

  it('rejects requests with an unallowlisted Host header (HTTP 421)', async () => {
    const req = new Request('https://evil.attacker.invalid/auth/callback', {
      headers: { host: 'evil.attacker.invalid' },
    });

    const res = await GET(req);
    expect(res.status).toBe(421);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('HOST_NOT_ALLOWED');
  });

  it('rejects requests with mismatched Host and X-Forwarded-Host headers (HTTP 421)', async () => {
    const req = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/auth/callback`, {
      headers: {
        host: PRODUCTION_TECHNICAL_HOSTNAME,
        'x-forwarded-host': 'evil.attacker.invalid',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(421);
  });

  it('redirects allowlisted requests to /login on the validated origin', async () => {
    const req = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/auth/callback`, {
      headers: { host: PRODUCTION_TECHNICAL_HOSTNAME },
    });

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${PRODUCTION_TECHNICAL_ORIGIN}/login`);
  });
});
