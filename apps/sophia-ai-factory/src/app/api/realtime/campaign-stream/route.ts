/**
 * Org-Isolated Campaign & Approval SSE Stream (SEC-01 / Gate G8)
 *
 * Streams live pending publish approvals and recent publishing jobs over
 * Server-Sent Events strictly scoped to verified organization_id memberships
 * from the authenticated Better Auth session.
 *
 * @module app/api/realtime/campaign-stream/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserWorkspaceIds, verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { listPendingPublishApprovals, type PublishLedgerRecord } from '@/tree/publishing/approval';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_TICKS = 12;

export interface CampaignStreamJobRow {
  id: string;
  tenant_id: string;
  provider: string;
  status: string;
  title: string | null;
  created_at: number;
}

export interface CampaignStreamSnapshot {
  scopedOrgIds: string[];
  pendingApprovals: PublishLedgerRecord[];
  recentJobs: CampaignStreamJobRow[];
  timestamp: string;
}

function extractRequestedOrgId(request: NextRequest): string | null {
  const raw =
    request.nextUrl.searchParams.get('organization_id') ??
    request.nextUrl.searchParams.get('orgId') ??
    request.headers.get('x-organization-id');
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

async function queryRecentJobs(scopedOrgIds: readonly string[], d1: D1Database): Promise<CampaignStreamJobRow[]> {
  if (scopedOrgIds.length === 0) return [];
  try {
    const placeholders = scopedOrgIds.map(() => '?').join(',');
    const res = await d1
      .prepare(
        `SELECT id, tenant_id, provider, status, title, created_at FROM publishing_jobs WHERE tenant_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(...scopedOrgIds)
      .all<CampaignStreamJobRow>();
    return res?.results ?? [];
  } catch {
    return [];
  }
}

async function buildSnapshot(scopedOrgIds: string[], d1: D1Database): Promise<CampaignStreamSnapshot> {
  const [pendingApprovals, recentJobs] = await Promise.all([
    scopedOrgIds.length > 0 ? listPendingPublishApprovals(scopedOrgIds, 20, d1) : Promise.resolve([]),
    queryRecentJobs(scopedOrgIds, d1),
  ]);
  return { scopedOrgIds, pendingApprovals, recentJobs, timestamp: new Date().toISOString() };
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const d1 = await getD1();
  if (!d1) return NextResponse.json({ error: 'Database not available' }, { status: 503 });

  const requestedOrgId = extractRequestedOrgId(request);
  let scopedOrgIds: string[];
  if (requestedOrgId) {
    const hasAccess = await verifyWorkspaceAccess(requestedOrgId, user.id, d1);
    if (!hasAccess) {
      logger.warn('[api/realtime/campaign-stream] Cross-tenant access denied', {
        userId: user.id,
        organizationId: requestedOrgId,
      });
      return NextResponse.json(
        { error: 'Forbidden: cross-tenant organization_id access denied' },
        { status: 403 },
      );
    }
    scopedOrgIds = [requestedOrgId];
  } else {
    scopedOrgIds = await getUserWorkspaceIds(user.id, d1);
  }

  const once = request.nextUrl.searchParams.get('once') === '1';
  const parsedMaxTicks = parseInt(request.nextUrl.searchParams.get('maxTicks') || String(DEFAULT_MAX_TICKS), 10);
  const maxTicks = once
    ? 1
    : Math.min(Math.max(Number.isFinite(parsedMaxTicks) ? parsedMaxTicks : DEFAULT_MAX_TICKS, 1), DEFAULT_MAX_TICKS);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const cleanup = () => {
    closed = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const closeStream = () => {
        if (closed) return;
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      };

      request.signal.addEventListener('abort', closeStream, { once: true });

      const enqueueSnapshot = async () => {
        const snapshot = await buildSnapshot(scopedOrgIds, d1);
        if (closed || request.signal.aborted) return;
        controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
      };

      try {
        controller.enqueue(encoder.encode('retry: 3000\n'));
        await enqueueSnapshot();
      } catch (err) {
        logger.error('[api/realtime/campaign-stream] Initial snapshot failed', { error: toError(err).message });
        closeStream();
        return;
      }

      if (maxTicks <= 1 || request.signal.aborted) {
        closeStream();
        return;
      }

      let tick = 1;
      const scheduleNext = () => {
        if (closed || request.signal.aborted || tick >= maxTicks) {
          closeStream();
          return;
        }
        timer = setTimeout(async () => {
          tick += 1;
          try {
            await enqueueSnapshot();
          } catch (err) {
            logger.warn('[api/realtime/campaign-stream] Poll tick failed', { error: toError(err).message });
          }
          if (tick >= maxTicks || request.signal.aborted) closeStream();
          else scheduleNext();
        }, POLL_INTERVAL_MS);
      };

      scheduleNext();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
