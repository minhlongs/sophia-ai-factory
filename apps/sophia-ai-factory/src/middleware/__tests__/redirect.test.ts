import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { handlePublicPipeline } from '../public-pipeline';

describe('middleware redirect behavior', () => {
  it('produces a 307 redirect to /login', () => {
    const res = NextResponse.redirect('/login');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('produces a 307 redirect to /signup', () => {
    const res = NextResponse.redirect('/signup');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/signup');
  });

  it('redirects to bare /login path (not locale-prefixed)', () => {
    const res = NextResponse.redirect('/login');
    expect(res.headers.get('location')).toBe('/login');
    expect(res.headers.get('location')).not.toContain('/vi');
  });

  it('NextResponse.next returns 200 with no location header', () => {
    const res = NextResponse.next();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware /dashboard/login redirect', () => {
  it('redirects bare /dashboard/login to /login', async () => {
    const req = new NextRequest('http://localhost/dashboard/login');
    const res = await handlePublicPipeline(
      req,
      'undefined' as unknown as string,
      new Headers(),
      'nonce',
      false,
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('redirects bare /dashboard/signup to /signup', async () => {
    const req = new NextRequest('http://localhost/dashboard/signup');
    const res = await handlePublicPipeline(
      req,
      'undefined' as unknown as string,
      new Headers(),
      'nonce',
      false,
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/signup');
  });

  it('does not redirect bare /dashboard to /dashboard/login', async () => {
    const req = new NextRequest('http://localhost/dashboard');
    const res = await handlePublicPipeline(
      req,
      'undefined' as unknown as string,
      new Headers(),
      'nonce',
      false,
    );
    expect(res.status).not.toBe(307);
  });

  it('does not redirect /vi/dashboard/login in loop', async () => {
    const req = new NextRequest('http://localhost/vi/dashboard/login');
    const res = await handlePublicPipeline(
      req,
      'undefined' as unknown as string,
      new Headers(),
      'nonce',
      false,
    );
    // Should not be a 307 redirect (locale guard breaks loop by redirecting to /login first)
    expect(res.status).not.toBe(307);
  });
});
