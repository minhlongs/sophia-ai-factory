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
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  campaignStream,
  encodeSSE,
  MAX_STREAM_DURATION_MS, // eslint-disable-line @typescript-eslint/no-unused-vars
} from '@/forest/streaming/campaign-stream-service';
import type { ErrorEvent } from '@/forest/streaming/campaign-stream-types';

export const dynamic = 'force-dynamic';

/**
 * Verify the authenticated user owns (or is a member of) the org that owns the campaign.
 * Returns the campaign's org_id on success, null on auth failure.
 */
async function verifyCampaignOwnership(
  campaignId: string,
  userId: string,
): Promise<string | null> {
  const db = createServerClient();

  // First try org-scoped lookup (preferred for multi-tenant)
  const { data: orgMember } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (orgMember && (orgMember as { org_id: string }).org_id) {
    const orgId = (orgMember as { org_id: string }).org_id;
    const { data: campaign } = await db
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (campaign) return orgId;
  }

  // Fallback: direct user_id ownership (legacy / single-user orgs)
  const { data: owned } = await db
    .from('campaigns')
    .select('id, org_id')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .maybeSingle();

  if (owned) return (owned as { org_id: string | null }).org_id ?? userId;

  return null;
}

function makeErrorResponse(
  status: number,
  event: ErrorEvent,
): Response {
  return new Response(encodeSSE(event), {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const campaignId = params.id;

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

  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of campaignStream(campaignId)) {
          if (request.signal.aborted) break;
          controller.enqueue(encodeSSE(event));
        }
      } catch (err) {
        logger.error(
          '[stream/campaigns] stream error',
          err instanceof Error ? err : new Error(String(err)),
          { campaignId, userId: user.id },
        );
        try {
          controller.enqueue(
            encodeSSE({
              type: 'error',
              timestamp: new Date().toISOString(),
              campaignId,
              code: 'STREAM_ERROR',
              message: 'Internal stream error',
              terminal: true,
            }),
          );
        } catch {
          // Controller already closed — ignore
        }
      } finally {
        const duration = Date.now() - startedAt;
        logger.info('[stream/campaigns] SSE connection closed', {
          campaignId,
          userId: user.id,
          durationMs: duration,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
