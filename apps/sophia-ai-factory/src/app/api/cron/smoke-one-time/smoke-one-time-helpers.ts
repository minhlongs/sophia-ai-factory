/**
 * Phase A check and Phase B creation helpers for smoke-one-time synthetic monitor cron.
 * @module app/api/cron/smoke-one-time/smoke-one-time-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { triggerOneTimeFulfillment } from '@/land/fulfillment/one-time-fulfillment';
import { markPaid } from '@/seed/db/repositories/user-purchases-repo';
import { cleanupSyntheticArtifacts } from '@/land/monitoring/synthetic-cleanup';
import { sendSlackAlert } from '@/land/monitoring/slack-alert';
import { SYNTHETIC_USER_ID } from '@/seed/config/synthetic-monitoring';

export const CRON_NAME = 'smoke-one-time';
const STALE_THRESHOLD_SEC = 10 * 60;

interface SyntheticCheckRow {
  id: string;
  payment_id: string;
  created_at: number;
}

interface VideoStatusRow {
  status: string;
  id: string;
}

export async function runSmokePhaseACheck(db: D1Database, nowSec: number): Promise<boolean> {
  let alertFired = false;
  try {
    const staleRows = await db
      .prepare(
        `SELECT id, payment_id, created_at
         FROM user_purchases
         WHERE user_id = ?1
           AND payment_id LIKE 'SYNTHETIC_%'
           AND status = 'paid'
           AND created_at < ?2`,
      )
      .bind(SYNTHETIC_USER_ID, nowSec - STALE_THRESHOLD_SEC)
      .all<SyntheticCheckRow>();

    for (const purchase of staleRows.results ?? []) {
      const videoRow = await db
        .prepare(
          `SELECT id, status FROM videos
           WHERE purchase_id = ?1 AND status = 'completed'
           LIMIT 1`,
        )
        .bind(purchase.id)
        .first<VideoStatusRow>();

      if (!videoRow) {
        const ageMin = Math.round((nowSec - purchase.created_at) / 60);
        alertFired = true;

        logger.error('[smoke-one-time] Synthetic fulfillment stale — alerting', undefined, {
          purchaseId: purchase.id,
          ageMinutes: ageMin,
        });

        await sendSlackAlert('high', `Synthetic fulfillment STALE after ${ageMin}min`, {
          purchaseId: purchase.id,
          ageMinutes: ageMin,
          environment: process.env.NODE_ENV ?? 'unknown',
        });
      }

      await cleanupSyntheticArtifacts(purchase.id);
    }
  } catch (err) {
    logger.warn('[smoke-one-time] Phase A check failed', { error: getErrorMessage(err) });
  }
  return alertFired;
}

export async function runSmokePhaseBCreate(db: D1Database): Promise<boolean> {
  const paymentId = `SYNTHETIC_${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 365 * 24 * 60 * 60;

  const newId = (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`).replace(/-/g, '');
  let purchaseId: string | null = null;
  try {
    await db
      .prepare(
        `INSERT INTO user_purchases (id, user_id, kind, sku, payment_id, amount_cents, credits_total, credits_remaining, expires_at, status, created_at, updated_at)
         VALUES (?, ?, 'one_time', 'STARTER_BUNDLE', ?, 0, 1, 1, ?, 'pending', ?, ?)`,
      )
      .bind(newId, SYNTHETIC_USER_ID, paymentId, expiresAt, now, now)
      .run();
    purchaseId = newId;
  } catch (insertErr) {
    logger.warn('[smoke-one-time] Raw D1 insert failed', { error: getErrorMessage(insertErr), paymentId });
  }

  if (!purchaseId) return false;

  await markPaid(paymentId, 1, expiresAt);

  await triggerOneTimeFulfillment(SYNTHETIC_USER_ID, purchaseId, {
    id: 'STARTER_BUNDLE',
    invoiceId: '0000000000',
    priceUsd: 0,
    credits: 1,
    ttlMonths: 12,
    label_vi: 'Synthetic',
    label_en: 'Synthetic',
  });

  logger.info('[smoke-one-time] Synthetic purchase triggered', { purchaseId, paymentId });
  return true;
}
