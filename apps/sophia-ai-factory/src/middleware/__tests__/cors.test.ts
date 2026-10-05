import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import { handleCorsPrelight, applyCorsHeaders } from '../cors';

describe('CORS middleware utilities', () => {
  const origEnv = process.env.CORS_ALLOWED_ORIGINS;

  beforeEach(() => {
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.CORS_ALLOWED_ORIGINS = origEnv;
    } else {
      delete process.env.CORS_ALLOWED_ORIGINS;
    }
  });

  it('returns 204 for null origin', () => {
    const res = handleCorsPrelight(null);
    expect(res.status).toBe(204);
  });

  it('returns 204 when CORS_ALLOWED_ORIGINS is not set', () => {
    const res = handleCorsPrelight('https://example.com');
    expect(res.status).toBe(204);
  });

  it('returns 204 when origin does not match allowlist', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com,https://api.example.com';
    const res = handleCorsPrelight('https://evil.com');
    expect(res.status).toBe(204);
  });

  it('returns 200 with CORS headers when origin is explicitly allowed', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com, https://api.example.com';
    const res = handleCorsPrelight('https://app.example.com');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(res.headers.get('Vary')).toBe('Origin');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET, POST');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('returns 200 when wildcard * is allowed', () => {
    process.env.CORS_ALLOWED_ORIGINS = '*';
    const res = handleCorsPrelight('https://any-domain.com');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://any-domain.com');
  });

  it('applyCorsHeaders attaches headers to existing response for allowed origin', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
    const res = NextResponse.json({ ok: true });
    const modified = applyCorsHeaders(res, 'https://app.example.com');
    expect(modified.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(modified.headers.get('Vary')).toBe('Origin');
  });

  it('applyCorsHeaders does not attach headers for disallowed origin', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
    const res = NextResponse.json({ ok: true });
    const modified = applyCorsHeaders(res, 'https://evil.com');
    expect(modified.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
