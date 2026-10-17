/**
 * Internal helpers for GET /api/stream/campaigns/[id] SSE route.
 *
 * Handles campaign ownership verification, SSE headers, error responses,
 * and ReadableStream creation.
 */

import { createServerClient } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { logger } from '@/seed/utils/logger-utility';
import {
  campaignStream,
  encodeSSE,
} from '@/forest/streaming/campaign-stream-service';
import type { ErrorEvent } from '@/forest/streaming/campaign-stream-types';

export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Verify the authenticated user owns (or is a member of) the org that owns the campaign.
 * Returns the campaign's org_id on success, null on auth failure.
 */
export async function verifyCampaignOwnership(
  campaignId: string,
  userId: string,
): Promise<string | null> {
  const db = createServerClient();

  // First try org-scoped lookup (preferred for multi-tenant)
  const orgId = await resolveOrgId(userId, db);

  if (orgId) {
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

export function makeErrorResponse(
  status: number,
  event: ErrorEvent,
): Response {
  return new Response(encodeSSE(event), {
    status,
    headers: SSE_HEADERS,
  });
}

export function createCampaignReadableStream(
  campaignId: string,
  userId: string,
  signal: AbortSignal,
): ReadableStream {
  const startedAt = Date.now();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of campaignStream(campaignId)) {
          if (signal.aborted) break;
          controller.enqueue(encodeSSE(event));
        }
      } catch (err) {
        logger.error(
          '[stream/campaigns] stream error',
          err instanceof Error ? err : new Error(String(err)),
          { campaignId, userId },
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
          userId,
          durationMs: duration,
        });
        controller.close();
      }
    },
  });
}
