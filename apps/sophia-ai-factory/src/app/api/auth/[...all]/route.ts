/**
 * Better Auth catch-all API handler.
 *
 * Handles: sign-in, sign-up, sign-out, get-session, magic-link, etc.
 * Existing specific routes (tiktok/callback, youtube/callback) take
 * precedence over this catch-all in Next.js routing.
 */

import { getAuth } from '@/lib/better-auth-server';
import { toNextJsHandler } from 'better-auth/next-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = getAuth();
  const { GET: handler } = toNextJsHandler(auth);
  return handler(request);
}

export async function POST(request: Request) {
  const auth = getAuth();
  const { POST: handler } = toNextJsHandler(auth);
  return handler(request);
}
