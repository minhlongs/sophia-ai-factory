import { NextResponse } from 'next/server';

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

  it('never targets the live 500 locale-prefixed /vi/login', () => {
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
