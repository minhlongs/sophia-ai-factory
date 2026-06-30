import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyCorsHeaders } from './cors';
import { intlMiddleware, applySecurityHeaders } from './middleware-shared-config';

export async function handlePublicPipeline(
  request: NextRequest,
  origin: string | null,
  requestHeaders: Headers,
  nonce: string,
  needsCsrfSeed: boolean,
): Promise<NextResponse> {
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const intlRes = intlMiddleware(request);
  const location = intlRes.headers.get('location');

  if (location) {
    const redirectRes = applyCorsHeaders(NextResponse.redirect(new URL(location, request.url)), origin);
    intlRes.headers.forEach((v, k) => { if (k.toLowerCase() !== 'location') redirectRes.headers.set(k, v); });
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }

  intlRes.headers.forEach((v, k) => response.headers.set(k, v));
  applySecurityHeaders(response, nonce, needsCsrfSeed);
  return response;
}
