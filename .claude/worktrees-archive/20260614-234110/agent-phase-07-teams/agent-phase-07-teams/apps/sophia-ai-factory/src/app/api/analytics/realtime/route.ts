/**
 * GET /api/analytics/realtime
 *
 * Server-Sent Events endpoint for real-time analytics dashboard.
 * Streams a snapshot every 10 seconds.
 *
 * RBAC: Admin-only (MASTER tier or role=admin)
 */

import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { checkAdmin } from '@/land/analytics/rbac';
import { fetchRealtimeSnapshot } from '@/land/analytics/realtime-snapshot';
import { createSSEStream } from '@/land/analytics/sse-broadcaster';


/** SSE response headers per spec */
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable nginx buffering for SSE
} as const;

export async function GET(_request: NextRequest): Promise<Response> {
  // Step 1: Authenticate
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Step 2: Admin-only gate
  const isAdmin = await checkAdmin(user.id);

  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Forbidden - admin access required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Step 3: Create SSE stream
  const stream = createSSEStream(fetchRealtimeSnapshot);

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
