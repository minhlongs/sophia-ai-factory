/**
 * GET /api/openapi — serves the OpenAPI 3.1 JSON spec, public + cacheable.
 */

import { describe, it, expect } from 'vitest';
import { GET } from '../route';

describe('GET /api/openapi', () => {
  it('returns 200 with OpenAPI 3.1 JSON body', async () => {
    const resp = await GET();
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe('3.1.0');
    expect(Object.keys(body.paths).length).toBeGreaterThan(0);
  });

  it('sets a public Cache-Control header', async () => {
    const resp = await GET();
    const entries: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      entries[key.toLowerCase()] = value;
    });
    expect(entries['cache-control']).toBeDefined();
    expect(entries['cache-control']).toMatch(/public/);
  });
});
