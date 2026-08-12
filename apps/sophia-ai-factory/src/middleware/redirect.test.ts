import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handlePublicPipeline } from './public-pipeline';
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