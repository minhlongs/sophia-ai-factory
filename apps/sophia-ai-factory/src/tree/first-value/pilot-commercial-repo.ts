/**
 * Durable Cloudflare D1 repository for Customer Pilot MP4 Export Receipts &
 * Manual Publish / Honest `CUSTOMER_SELF_REPORTED` Affiliate Ledger.
 *
 * Strictly tenant-scoped by `(org_id, user_id)` and deduplicates repeated
 * submissions for the same `published_post_url` via `ON CONFLICT DO UPDATE`.
 *
 * @module tree/first-value/pilot-commercial-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PilotManualPublishSummary,
  PilotMp4ExportSummary,
} from '@/seed/pilot/pilot-access-policy';
import { validateHttpsDestinationUrl } from './pilot-shortlink-repo';

export {
  createPilotAffiliateShortlink,
  generatePilotShortCode,
  getPilotAffiliateLinkByCodeForUser,
  getPilotAffiliateLinkByIdForUser,
  hashPilotVisitorIp,
  listPilotAffiliateLinks,
  resolveAffiliateSubIdParam,
  resolveAndRecordPilotShortlinkClick,
  validateHttpsDestinationUrl,
} from './pilot-shortlink-repo';

function mapMp4Row(row: Record<string, unknown>): PilotMp4ExportSummary {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id ?? ''),
    renderMode: row.render_mode === 'heygen_byok_mp4' ? 'heygen_byok_mp4' : 'browser_h264_mp4',
    heygenJobId: row.heygen_job_id ? String(row.heygen_job_id) : null,
    status: row.status === 'completed' || row.status === 'failed' ? row.status : 'processing',
    sha256Hex: row.sha256_hex ? String(row.sha256_hex) : null,
    byteSize: row.byte_size != null ? Number(row.byte_size) : null,
    durationSec: row.duration_sec != null ? Number(row.duration_sec) : null,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    codec: String(row.codec ?? 'h264'),
    containerBrand: String(row.container_brand ?? 'isom'),
    ctaText: String(row.cta_text ?? ''),
    shortCode: String(row.short_code ?? ''),
    referralUrl: String(row.referral_url ?? ''),
    providerVideoUrl: row.provider_video_url ? String(row.provider_video_url) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    createdAtIso: String(row.created_at_iso ?? ''),
    updatedAtIso: String(row.updated_at_iso ?? ''),
  };
}

export async function recordPilotMp4Export(
  d1: D1Database,
  input: {
    readonly id?: string;
    readonly orgId: string;
    readonly userId: string;
    readonly artifactId: string;
    readonly renderMode: 'browser_h264_mp4' | 'heygen_byok_mp4';
    readonly heygenJobId?: string | null;
    readonly status: 'processing' | 'completed' | 'failed';
    readonly sha256Hex?: string | null;
    readonly byteSize?: number | null;
    readonly durationSec?: number | null;
    readonly width?: number | null;
    readonly height?: number | null;
    readonly codec?: string;
    readonly containerBrand?: string;
    readonly ctaText: string;
    readonly shortCode: string;
    readonly referralUrl: string;
    readonly providerVideoUrl?: string | null;
    readonly errorCode?: string | null;
    readonly nowIso: string;
  },
): Promise<PilotMp4ExportSummary> {
  const id = input.id ?? `pme_${crypto.randomUUID()}`;
  const codec = input.codec ?? 'h264';
  const containerBrand = input.containerBrand ?? 'isom';

  await d1
    .prepare(
      `INSERT INTO pilot_mp4_exports (
        id, org_id, user_id, artifact_id, render_mode, heygen_job_id, status,
        sha256_hex, byte_size, duration_sec, width, height, codec, container_brand,
        cta_text, short_code, referral_url, provider_video_url, error_code,
        created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.orgId,
      input.userId,
      input.artifactId,
      input.renderMode,
      input.heygenJobId ?? null,
      input.status,
      input.sha256Hex ?? null,
      input.byteSize ?? null,
      input.durationSec ?? null,
      input.width ?? null,
      input.height ?? null,
      codec,
      containerBrand,
      input.ctaText,
      input.shortCode,
      input.referralUrl,
      input.providerVideoUrl ?? null,
      input.errorCode ?? null,
      input.nowIso,
      input.nowIso,
    )
    .run();

  return {
    id,
    artifactId: input.artifactId,
    renderMode: input.renderMode,
    heygenJobId: input.heygenJobId ?? null,
    status: input.status,
    sha256Hex: input.sha256Hex ?? null,
    byteSize: input.byteSize ?? null,
    durationSec: input.durationSec ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    codec,
    containerBrand,
    ctaText: input.ctaText,
    shortCode: input.shortCode,
    referralUrl: input.referralUrl,
    providerVideoUrl: input.providerVideoUrl ?? null,
    errorCode: input.errorCode ?? null,
    createdAtIso: input.nowIso,
    updatedAtIso: input.nowIso,
  };
}

export async function getPilotMp4ExportByIdForUser(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly exportId: string },
): Promise<PilotMp4ExportSummary | null> {
  const row = await d1
    .prepare(
      `SELECT id, artifact_id, render_mode, heygen_job_id, status, sha256_hex,
              byte_size, duration_sec, width, height, codec, container_brand,
              cta_text, short_code, referral_url, provider_video_url, error_code,
              created_at_iso, updated_at_iso
       FROM pilot_mp4_exports
       WHERE id = ? AND org_id = ? AND user_id = ?
       LIMIT 1`,
    )
    .bind(args.exportId, args.orgId, args.userId)
    .first<Record<string, unknown>>();
  return row ? mapMp4Row(row) : null;
}

export async function updatePilotMp4ExportStatus(
  d1: D1Database,
  args: {
    readonly id: string;
    readonly orgId: string;
    readonly userId: string;
    readonly status: 'processing' | 'completed' | 'failed';
    readonly providerVideoUrl?: string | null;
    readonly durationSec?: number | null;
    readonly sha256Hex?: string | null;
    readonly byteSize?: number | null;
    readonly errorCode?: string | null;
    readonly nowIso: string;
  },
): Promise<PilotMp4ExportSummary | null> {
  await d1
    .prepare(
      `UPDATE pilot_mp4_exports
       SET status = ?,
           provider_video_url = COALESCE(?, provider_video_url),
           duration_sec = COALESCE(?, duration_sec),
           sha256_hex = COALESCE(?, sha256_hex),
           byte_size = COALESCE(?, byte_size),
           error_code = ?,
           updated_at_iso = ?
       WHERE id = ? AND org_id = ? AND user_id = ?`,
    )
    .bind(
      args.status,
      args.providerVideoUrl ?? null,
      args.durationSec ?? null,
      args.sha256Hex ?? null,
      args.byteSize ?? null,
      args.errorCode ?? null,
      args.nowIso,
      args.id,
      args.orgId,
      args.userId,
    )
    .run();
  return getPilotMp4ExportByIdForUser(d1, {
    orgId: args.orgId,
    userId: args.userId,
    exportId: args.id,
  });
}

export async function listPilotMp4Exports(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string },
): Promise<readonly PilotMp4ExportSummary[]> {
  try {
    const res = await d1
      .prepare(
        `SELECT id, artifact_id, render_mode, heygen_job_id, status, sha256_hex,
                byte_size, duration_sec, width, height, codec, container_brand,
                cta_text, short_code, referral_url, provider_video_url, error_code,
                created_at_iso, updated_at_iso
         FROM pilot_mp4_exports
         WHERE org_id = ? AND user_id = ?
         ORDER BY created_at_iso DESC
         LIMIT 20`,
      )
      .bind(args.orgId, args.userId)
      .all<Record<string, unknown>>();
    return (res.results ?? []).map(mapMp4Row);
  } catch {
    return [];
  }
}

export async function recordPilotManualPublish(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly artifactId: string | null;
    readonly mp4ExportId: string | null;
    readonly linkId: string | null;
    readonly platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels' | 'other';
    readonly publishedPostUrl: string;
    readonly reportedViews: number | null;
    readonly reportedConversions: number | null;
    readonly reportedCommissionAmount: number | null;
    readonly reportedCommissionCurrency: string | null;
    readonly evidenceNote: string | null;
    readonly nowIso: string;
  },
): Promise<PilotManualPublishSummary> {
  const validPostUrl = validateHttpsDestinationUrl(input.publishedPostUrl).toString();
  const candidateId = `pmp_${crypto.randomUUID()}`;
  const currency = input.reportedCommissionCurrency?.trim().toUpperCase() || null;

  await d1
    .prepare(
      `INSERT INTO pilot_manual_publishes (
        id, org_id, user_id, artifact_id, mp4_export_id, link_id, platform,
        published_post_url, reported_views, reported_conversions,
        reported_commission_amount, reported_commission_currency, evidence_note,
        provenance, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CUSTOMER_SELF_REPORTED', ?, ?)
      ON CONFLICT(org_id, user_id, published_post_url) DO UPDATE SET
        artifact_id = COALESCE(excluded.artifact_id, pilot_manual_publishes.artifact_id),
        mp4_export_id = COALESCE(excluded.mp4_export_id, pilot_manual_publishes.mp4_export_id),
        link_id = COALESCE(excluded.link_id, pilot_manual_publishes.link_id),
        platform = excluded.platform,
        reported_views = excluded.reported_views,
        reported_conversions = excluded.reported_conversions,
        reported_commission_amount = excluded.reported_commission_amount,
        reported_commission_currency = excluded.reported_commission_currency,
        evidence_note = excluded.evidence_note,
        updated_at_iso = excluded.updated_at_iso`,
    )
    .bind(
      candidateId,
      input.orgId,
      input.userId,
      input.artifactId,
      input.mp4ExportId,
      input.linkId,
      input.platform,
      validPostUrl,
      input.reportedViews,
      input.reportedConversions,
      input.reportedCommissionAmount,
      currency,
      input.evidenceNote,
      input.nowIso,
      input.nowIso,
    )
    .run();

  const stored = await d1
    .prepare(
      `SELECT id, created_at_iso
       FROM pilot_manual_publishes
       WHERE org_id = ? AND user_id = ? AND published_post_url = ?
       LIMIT 1`,
    )
    .bind(input.orgId, input.userId, validPostUrl)
    .first<{ id: string; created_at_iso: string }>();

  return {
    id: stored?.id ?? candidateId,
    artifactId: input.artifactId,
    mp4ExportId: input.mp4ExportId,
    linkId: input.linkId,
    platform: input.platform,
    publishedPostUrl: validPostUrl,
    reportedViews: input.reportedViews,
    reportedConversions: input.reportedConversions,
    reportedCommissionAmount: input.reportedCommissionAmount,
    reportedCommissionCurrency: currency,
    evidenceNote: input.evidenceNote,
    provenance: 'CUSTOMER_SELF_REPORTED',
    createdAtIso: stored?.created_at_iso ?? input.nowIso,
  };
}

export async function listPilotManualPublishes(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string },
): Promise<readonly PilotManualPublishSummary[]> {
  try {
    const res = await d1
      .prepare(
        `SELECT id, artifact_id, mp4_export_id, link_id, platform, published_post_url,
                reported_views, reported_conversions, reported_commission_amount,
                reported_commission_currency, evidence_note, created_at_iso
         FROM pilot_manual_publishes
         WHERE org_id = ? AND user_id = ?
         ORDER BY updated_at_iso DESC
         LIMIT 20`,
      )
      .bind(args.orgId, args.userId)
      .all<Record<string, unknown>>();

    return (res.results ?? []).map((row) => ({
      id: String(row.id),
      artifactId: row.artifact_id ? String(row.artifact_id) : null,
      mp4ExportId: row.mp4_export_id ? String(row.mp4_export_id) : null,
      linkId: row.link_id ? String(row.link_id) : null,
      platform: (['tiktok', 'youtube_shorts', 'instagram_reels', 'facebook_reels', 'other'].includes(
        String(row.platform),
      )
        ? String(row.platform)
        : 'other') as PilotManualPublishSummary['platform'],
      publishedPostUrl: String(row.published_post_url ?? ''),
      reportedViews: row.reported_views != null ? Number(row.reported_views) : null,
      reportedConversions:
        row.reported_conversions != null ? Number(row.reported_conversions) : null,
      reportedCommissionAmount:
        row.reported_commission_amount != null ? Number(row.reported_commission_amount) : null,
      reportedCommissionCurrency: row.reported_commission_currency
        ? String(row.reported_commission_currency)
        : null,
      evidenceNote: row.evidence_note ? String(row.evidence_note) : null,
      provenance: 'CUSTOMER_SELF_REPORTED',
      createdAtIso: String(row.created_at_iso ?? ''),
    }));
  } catch {
    return [];
  }
}
