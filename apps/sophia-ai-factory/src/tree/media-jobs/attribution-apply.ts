/**
 * @module tree/media-jobs/attribution-apply
 *
 * Apply a revenue attribution to a media_job row (SUPREME COMMAND #10 — Phase 3).
 *
 * This is the SOLE tree-layer entry point that writes `revenue_attribution`
 * and `gross_margin` to `media_jobs`. It delegates margin math to the seed
 * pure function `computeGrossMargin` — the single source of truth for the four
 * margin states (see seed/types/creative-job-economics.ts).
 *
 * Layer rule: tree — imports from seed only. No forest/land imports.
 */

import { computeGrossMargin } from '@/seed/types/creative-job-economics';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AttributionApplyParams {
  jobId: string;
  sourceEventId: string;
  sourceType: 'conversion' | 'revenue';
  channel: 'tiktok' | 'youtube';
  valueCents: number;
  recordedAt: number; // performance_events.recorded_at — MILLISECONDS
  jobCompletedAt: number; // media_jobs.completed_at — SECONDS
  providerCostCents: number | null;
  windowDays?: number; // default 30
  attributionRule?: string; // default 'last-touch-within-window'
}

export interface AttributionApplyResult {
  attributed: boolean;
  revenueCents: number | null;
  grossMarginPercent: number | null; // percent, e.g. 42.5 means 42.5%
  reason: 'attributed' | 'no_candidate' | 'window_expired' | 'already_owned';
}

interface AttributionProvenanceRow {
  media_job_id: string;
  source_event_id: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `attprov_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * Apply a revenue attribution to a media_job.
 *
 * Idempotency: `INSERT OR IGNORE` on the `attribution_provenance` UNIQUE
 * (media_job_id, source_event_id) constraint. `meta.changes === 1` proves
 * this call owns the row (D1 has no transactions — see CLAUDE.md financial
 * patterns). If another run already claimed this event, the UPDATE is skipped.
 *
 * Margin: `computeGrossMargin(providerCostCents, valueCents)` returns null
 * unless BOTH inputs are non-null and revenue is non-zero. This preserves
 * the four-state semantics (see plan §5.1).
 */
export async function applyAttributionToJob(
  params: AttributionApplyParams,
): Promise<AttributionApplyResult> {
  const {
    jobId,
    sourceEventId,
    sourceType,
    channel,
    valueCents,
    recordedAt,
    jobCompletedAt,
    providerCostCents,
    windowDays = 30,
    attributionRule = 'last-touch-within-window',
  } = params;

  const db = await getD1();
  if (!db) throw new Error('D1_UNAVAILABLE: D1 database binding not available');

  // Native-unit storage: completed_at is seconds, recorded_at is ms.
  // Do NOT compare them directly — the provenance table stores both as-is.
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO attribution_provenance
         (id, media_job_id, source_event_id, source_type, channel,
          attributed_amount_cents, attribution_rule, attribution_window_days,
          job_completed_at, revenue_recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      generateId(),
      jobId,
      sourceEventId,
      sourceType,
      channel,
      valueCents,
      attributionRule,
      windowDays,
      jobCompletedAt,
      recordedAt,
    )
    .run();

  const changes = result.meta?.changes ?? 0;
  if (changes === 0) {
    logger.debug('[attribution-apply] Provenance already owned — skipping', {
      jobId,
      sourceEventId,
    });
    return { attributed: false, revenueCents: null, grossMarginPercent: null, reason: 'already_owned' };
  }

  const grossMarginPercent = computeGrossMargin(providerCostCents, valueCents);

  await db
    .prepare(`UPDATE media_jobs SET revenue_attribution = ?, gross_margin = ? WHERE id = ?`)
    .bind(valueCents, grossMarginPercent, jobId)
    .run();

  logger.info('[attribution-apply] Attributed', {
    jobId,
    sourceEventId,
    revenueCents: valueCents,
    grossMarginPercent,
  });

  return { attributed: true, revenueCents: valueCents, grossMarginPercent, reason: 'attributed' };
}