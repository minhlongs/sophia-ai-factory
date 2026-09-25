import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../middleware';

describe('Auth & Locale Routing Middleware', () => {
  it('redirects unsupported locales (/zh-CN) to /', async () => {
    const req = new NextRequest('http://localhost/zh-CN');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost/');
  });

  it('redirects unsupported locales (/de/pricing) to /', async () => {
    const req = new NextRequest('http://localhost/de/pricing');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost/');
  });

  it('redirects unsupported locales (/fr/login) to /', async () => {
    const req = new NextRequest('http://localhost/fr/login');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost/');
  });

  it('does NOT redirect bare /login to / (lets intlMiddleware handle it to /vi/login or similar)', async () => {
    const req = new NextRequest('http://localhost/login');
    const res = await proxy(req);
    // Should NOT redirect to root /
    const location = res.headers.get('location');
    if (res.status === 307 || res.status === 308) {
      expect(location).not.toBe('http://localhost/');
      expect(location).toMatch(/\/login/);
    }
  });

  it('does NOT redirect bare /register to /', async () => {
    const req = new NextRequest('http://localhost/register');
    const res = await proxy(req);
    const location = res.headers.get('location');
    if (res.status === 307 || res.status === 308) {
      expect(location).not.toBe('http://localhost/');
      expect(location).toMatch(/\/register/);
    }
  });

  it('does NOT redirect bare /signup to /', async () => {
    const req = new NextRequest('http://localhost/signup');
    const res = await proxy(req);
    const location = res.headers.get('location');
    if (res.status === 307 || res.status === 308) {
      expect(location).not.toBe('http://localhost/');
      expect(location).toMatch(/\/signup/);
    }
  });

  it('does NOT redirect bare /setup to /', async () => {
    const req = new NextRequest('http://localhost/setup');
    const res = await proxy(req);
    const location = res.headers.get('location');
    if (res.status === 307 || res.status === 308) {
      expect(location).not.toBe('http://localhost/');
      expect(location).toMatch(/\/setup/);
    }
  });

  it('passes through supported locale /vi/login without redirect to root', async () => {
    const req = new NextRequest('http://localhost/vi/login');
    const res = await proxy(req);
    const location = res.headers.get('location');
    expect(location).not.toBe('http://localhost/');
    expect(res.status).toBe(200);
  });

  it('passes through supported locale /en/register without redirect to root', async () => {
    const req = new NextRequest('http://localhost/en/register');
    const res = await proxy(req);
    const location = res.headers.get('location');
    expect(location).not.toBe('http://localhost/');
    expect(res.status).toBe(200);
  });
});
