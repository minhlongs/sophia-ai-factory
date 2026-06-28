/**
 * M2 — Admin promo-codes bare path regression tests
 * Verifies GET /api/admin/promo-codes returns 404 JSON and other methods return 405.
 * @module tests/security/m2-admin-promo-bare-path
 */

import { describe, it, expect } from 'vitest';

describe('M2 — /api/admin/promo-codes bare path guard', () => {
  it('GET returns 404 JSON (not HTML page fall-through)', async () => {
    const { GET } = await import('@/app/api/admin/promo-codes/route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('not_found');
  });

  it('POST returns 405 JSON', async () => {
    const { POST } = await import('@/app/api/admin/promo-codes/route');
    const res = await POST();
    expect(res.status).toBe(405);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('method_not_allowed');
  });

  it('PUT returns 405 JSON', async () => {
    const { PUT } = await import('@/app/api/admin/promo-codes/route');
    const res = await PUT();
    expect(res.status).toBe(405);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('method_not_allowed');
  });

  it('DELETE returns 405 JSON', async () => {
    const { DELETE } = await import('@/app/api/admin/promo-codes/route');
    const res = await DELETE();
    expect(res.status).toBe(405);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('method_not_allowed');
  });

  it('PATCH returns 405 JSON', async () => {
    const { PATCH } = await import('@/app/api/admin/promo-codes/route');
    const res = await PATCH();
    expect(res.status).toBe(405);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('method_not_allowed');
  });
});
