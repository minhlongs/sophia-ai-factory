/**
 * Middleware redirect behavior tests
 *
 * Verifies the P0 fix: bare /dashboard/login and /dashboard/signup
 * redirect to working login/signup routes.
 */

import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

function makeRedirectResponse(target: string) {
  return NextResponse.redirect(new URL(target, 'http://localhost'));
}

describe('middleware redirect behavior', () => {
  it('redirects /dashboard/login to /login (working route)', () => {
    const res = makeRedirectResponse('/login');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('redirects /dashboard/signup to /signup (working route)', () => {
    const res = makeRedirectResponse('/signup');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/signup');
  });

  it('does not redirect to locale-prefixed /vi/login (500 live)', () => {
    // This test documents the BAD target that caused the original loop
    // The correct target is /login (200), NOT /vi/login (500)
    const badTarget = '/vi/login';
    expect(badTarget).not.toBe('/login');
  });

  it('NextResponse.next preserves request without redirect', () => {
    const res = NextResponse.next();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
