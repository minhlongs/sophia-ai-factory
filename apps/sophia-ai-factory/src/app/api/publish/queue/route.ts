/**
 * GET /api/publish/queue
 *
 * Returns the current user's WhatsApp publish queue.
 * Auth: session cookie via getCurrentUser()
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    const jobs = await db
      .prepare(
        `SELECT
           pj.id, pj.video_id AS videoId, pj.channel_id AS target,
           pj.provider, pj.status, pj.caption, pj.scheduled_at AS scheduledAt,
           pj.created_at AS createdAt, pj.retry_count AS retryCount,
           wt.name AS templateName
         FROM publishing_jobs pj
         LEFT JOIN whatsapp_templates wt ON wt.id = CAST(pj.caption AS INTEGER)
         WHERE pj.tenant_id = ?1 AND pj.provider = 'whatsapp'
         ORDER BY pj.created_at DESC`,
      )
      .bind(user.id)
      .all<{
        id: string;
        videoId: string;
        target: string;
        provider: string;
        status: string;
        caption: string | null;
        scheduledAt: number;
        createdAt: number;
        retryCount: number;
        templateName: string | null;
      }>();

    const formatted = jobs.results.map((r) => ({
      id: r.id,
      videoId: r.videoId,
      videoTitle: r.target, // placeholder — video title lookup can be added later
      templateId: parseInt(r.caption || '0', 10),
      templateName: r.templateName || 'Unknown',
      target: r.target,
      status: r.status,
      createdAt: r.createdAt,
      sentAt: r.status === 'sent' ? r.scheduledAt : undefined,
      errorMessage: r.status === 'failed' ? 'Failed' : undefined,
    }));

    // Check if user has approved WhatsApp sends
    const approvalRow = await db
      .prepare(
        `SELECT whatsapp_approved FROM whatsapp_templates
         WHERE user_id = ?1 ORDER BY is_default DESC LIMIT 1`,
      )
      .bind(user.id)
      .first<{ whatsapp_approved: number }>();

    const showApprovalBanner = !approvalRow || approvalRow.whatsapp_approved !== 1;

    return NextResponse.json({ jobs: formatted, showApprovalBanner });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load queue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}