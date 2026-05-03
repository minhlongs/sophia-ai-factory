/**
 * Video Status Sync Cron
 *
 * Server-side cron that polls HeyGen for all videos stuck in "processing"
 * and updates their terminal status (completed | failed) in D1.
 * Ensures videos reach terminal state even when users close the browser.
 *
 * C3 fix: timeout + HeyGen-failed paths for one-time bundle rows (purchase_id IS NOT NULL)
 * now route through markPermanentFailure + compensation + email, instead of leaving
 * rows as orphaned 'failed' status invisible to retry cron + reconcile cron.
 *
 * Schedule: Add to wrangler.toml cron triggers (e.g. every 5 min)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun } from '@/lib/cron/run-tracker';
import { getD1Raw, createServerClient } from '@/seed/db/client';
import { getHeyGenClient } from '@/lib/heygen/heygen-client';
import { downloadAndStore } from '@/lib/video/video-storage-service';
import { logger } from '@/seed/utils/logger-utility';
import { sendOneTimeBundleReadyEmail } from '@/lib/billing/email/send-one-time-bundle-ready-email';
import { sendBundleRenderFailedEmail } from '@/lib/billing/email/send-bundle-render-failed-email';
import { grantCompensationCredit } from '@/lib/fulfillment/compensation';
import { getUserCredits } from '@/seed/db/get-user-credits';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'video-status-sync';
const TERMINAL = new Set<string>(['completed', 'failed', 'failed_permanent']);
/** Timeout: mark as permanently failed after 24 h */
const TIMEOUT_MS = 24 * 60 * 60 * 1000;

interface VideoRow {
  id: string;
  user_id: string;
  heygen_job_id: string;
  created_at: string;
  /** Nullable — present for one-time bundle videos */
  purchase_id?: string | null;
  /** Locale for email templates */
  locale?: string | null;
}

/** Fetch user info from Better Auth's 'user' table */
async function fetchUserInfo(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient()
    const { data } = await db.from('user').select('email, locale').eq('id', userId).single()
    const row = data as { email?: string; locale?: string } | null
    if (!row?.email) return null
    return { email: row.email, locale: row.locale ?? 'vi' }
  } catch {
    return null
  }
}

/**
 * Handle permanent failure for a one-time bundle video.
 * Writes failed_permanent, grants compensation credit, sends failure email.
 * Mirrors the exhaustion path in fulfillment-retry cron.
 */
async function handleOneBundlePermanentFailure(
  db: D1Database,
  row: VideoRow,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE videos SET status = 'failed_permanent', error = ?1, updated_at = ?2
       WHERE id = ?3`,
    )
    .bind(reason, new Date().toISOString(), row.id)
    .run()

  logger.warn('[video-status-sync] One-time bundle permanently failed', {
    videoId: row.id,
    purchaseId: row.purchase_id,
    reason,
  })

  const purchaseId = row.purchase_id!
  await grantCompensationCredit(purchaseId, reason)

  const userInfo = await fetchUserInfo(row.user_id)
  await sendBundleRenderFailedEmail({
    userEmail: userInfo?.email,
    userId: row.user_id,
    purchaseId,
    locale: userInfo?.locale ?? row.locale ?? 'vi',
  })
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  void start;

  // Auth — verifyCronAuth returns NextResponse on failure, null on success
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const summary = { checked: 0, terminal: 0, timedOut: 0, errors: 0 };

  let db: D1Database | null = null;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.error('[video-status-sync] D1 unavailable', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });
  }

  try {
    // Fetch pending videos (cap at 50 per run to stay within CPU limits)
    const rows = await db
      .prepare(
        `SELECT id, user_id, heygen_job_id, created_at, purchase_id, locale
         FROM videos
         WHERE status = 'processing'
         LIMIT 50`
      )
      .all<VideoRow>();

    const pending = rows.results ?? [];
    summary.checked = pending.length;

    const cutoff = Date.now() - TIMEOUT_MS;

    for (const row of pending) {
      try {
        const createdAt = new Date(row.created_at).getTime();

        // ── Timeout path ─────────────────────────────────────────────────────
        if (createdAt < cutoff) {
          if (row.purchase_id) {
            // C3: one-time bundle → permanent failure + compensation + email
            await handleOneBundlePermanentFailure(db, row, 'timeout_24h')
          } else {
            // Legacy onboarding video — keep existing 'failed' status (no retry cron pickup needed)
            await db
              .prepare(
                `UPDATE videos SET status = 'failed', error = 'timeout',
                 updated_at = ?1 WHERE id = ?2`
              )
              .bind(new Date().toISOString(), row.id)
              .run();
          }
          summary.timedOut += 1;
          continue;
        }

        // Per-row: user key first (one-time bundle), platform fallback for onboarding videos
        const client = await getHeyGenClient(row.user_id);
        if (!client) {
          logger.warn('[video-status-sync] No HeyGen key for row — skipping', {
            videoId: row.id,
            userId: row.user_id,
          });
          summary.errors += 1;
          continue;
        }

        const status = await client.getVideoStatus(row.heygen_job_id);

        if (TERMINAL.has(status.status)) {
          // Attempt to copy completed video to R2 for durable storage.
          // On failure: log and keep HeyGen URL — never block the cron run.
          let r2Key: string | null = null;
          let r2SizeBytes: number | null = null;

          if (status.status === 'completed' && status.video_url) {
            try {
              const storageKey = `videos/${row.user_id}/${row.id}.mp4`;
              const stored = await downloadAndStore(
                status.video_url,
                row.id,
                storageKey,
              );
              if (stored.path) {
                r2Key = stored.path;
                r2SizeBytes = stored.sizeBytes;
              }
            } catch (r2Err) {
              logger.error(
                '[video-status-sync] R2 copy failed — keeping HeyGen URL',
                r2Err instanceof Error ? r2Err : undefined,
                { videoId: row.id },
              );
            }
          }

          // ── HeyGen 'failed' path ────────────────────────────────────────
          if (status.status === 'failed' && row.purchase_id) {
            // C3: one-time bundle HeyGen failure → permanent failure + compensation + email
            await handleOneBundlePermanentFailure(db, row, status.error ?? 'heygen_failed')
            summary.terminal += 1;
            continue;
          }

          await db
            .prepare(
              `UPDATE videos SET
                 status = ?1,
                 video_url = ?2,
                 thumbnail_url = ?3,
                 error = ?4,
                 r2_key = ?5,
                 r2_size_bytes = ?6,
                 updated_at = ?7
               WHERE id = ?8`
            )
            .bind(
              status.status,
              status.video_url ?? null,
              status.thumbnail_url ?? null,
              status.error ?? null,
              r2Key,
              r2SizeBytes,
              new Date().toISOString(),
              row.id
            )
            .run();
          summary.terminal += 1;

          // One-time bundle: send ready email when video completes
          if (status.status === 'completed' && row.purchase_id) {
            try {
              const videoUrl = r2Key
                ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'}/dashboard/videos`
                : (status.video_url ?? undefined)
              const clientDb = createServerClient()
              const { data: purchaseData } = await clientDb
                .from('user_purchases')
                .select('user_id, credits_remaining, status')
                .eq('id', row.purchase_id)
                .single()
              const purchase = purchaseData as {
                user_id?: string;
                credits_remaining?: number;
                status?: string;
              } | null

              // M4: skip ready email if purchase was refunded
              if (purchase?.status === 'refunded') {
                logger.info('[video-status-sync] Skipping ready email — purchase refunded', {
                  videoId: row.id,
                  purchaseId: row.purchase_id,
                })
                continue
              }

              const ownerUserId = purchase?.user_id ?? row.user_id
              const { data: userData } = await clientDb
                .from('user')
                .select('email, locale')
                .eq('id', ownerUserId)
                .single()
              const user = userData as { email?: string; locale?: string } | null
              if (user?.email) {
                const { creditsRemaining } = await getUserCredits(ownerUserId)
                await sendOneTimeBundleReadyEmail({
                  userEmail: user.email,
                  userId: ownerUserId,
                  purchaseId: row.purchase_id,
                  creditsRemaining,
                  videoUrl: videoUrl ?? null,
                  locale: user.locale ?? 'vi',
                })
              }
            } catch (emailErr) {
              logger.warn('[video-status-sync] One-time bundle email failed (non-fatal)', {
                videoId: row.id,
                purchaseId: row.purchase_id,
                error: emailErr instanceof Error ? emailErr.message : String(emailErr),
              })
            }
          }
        }
      } catch (err) {
        summary.errors += 1;
        logger.error(
          '[video-status-sync] poll failed',
          err instanceof Error ? err : undefined,
          { videoId: row.id }
        );
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (db) await recordCronRun(db, CRON_NAME, 'failure', msg);
    logger.error('[video-status-sync] fatal', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 });
  }
}
