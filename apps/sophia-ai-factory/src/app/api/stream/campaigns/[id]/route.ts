/**
 * GET /api/stream/campaigns/[id] — SSE endpoint for real-time campaign progress.
 *
 * Streams progress_update, status_change, step_complete, error, heartbeat,
 * and stream_end events for a single campaign owned by the authenticated user.
 *
 * Auth: verifies session + org ownership of the campaign.
 * Cloudflare Workers compatible: ReadableStream + TextEncoder, max 58 s.
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  SSE_HEADERS,
  verifyCampaignOwnership,
  makeErrorResponse,
  createCampaignReadableStream,
} from './stream-route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaignId = id;

  if (!campaignId) {
    return makeErrorResponse(400, {
      type: 'error',
      timestamp: new Date().toISOString(),
      campaignId: '',
      code: 'MISSING_CAMPAIGN_ID',
      message: 'Campaign id is required',
      terminal: true,
    });
  }

  // Auth gate
  const user = await getCurrentUser();
  if (!user) {
    return makeErrorResponse(401, {
      type: 'error',
      timestamp: new Date().toISOString(),
      campaignId,
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
      terminal: true,
    });
  }

  // Ownership check
  const orgId = await verifyCampaignOwnership(campaignId, user.id);
  if (!orgId) {
    logger.warn('[stream/campaigns] unauthorized access attempt', {
      campaignId,
      userId: user.id,
    });
    return makeErrorResponse(403, {
      type: 'error',
      timestamp: new Date().toISOString(),
      campaignId,
      code: 'FORBIDDEN',
      message: 'Campaign not found or access denied',
      terminal: true,
    });
  }

  logger.info('[stream/campaigns] SSE connection opened', {
    campaignId,
    userId: user.id,
    orgId,
  });

  const stream = createCampaignReadableStream(
    campaignId,
    user.id,
    request.signal,
  );

  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}
