/**
 * /api/v1/missions/[id]/stream - SSE Stream for mission status
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/tree/missions/api-key-auth';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { createMissionStream } from './pipeline/index';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withRateLimit(async (r: NextRequest): Promise<NextResponse> => {
    const auth = await validateMissionApiKey(
      r.headers.get('authorization'),
      r.headers.get('x-api-key'),
    );
    if (!auth.valid) {
      return apiKeyAuthErrorResponse(auth) as NextResponse;
    }
    const userId = auth.userId!;

    const lastEventIdHeader = r.headers.get('last-event-id');
    const resumeCursor = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) || 0 : 0;

    const stream = createMissionStream({
      id,
      userId,
      resumeCursor,
      signal: r.signal,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }) as unknown as NextResponse;
  }, { addHeaders: false, config: { intervalMs: 60_000, maxRequests: 20 } })(request);
}
