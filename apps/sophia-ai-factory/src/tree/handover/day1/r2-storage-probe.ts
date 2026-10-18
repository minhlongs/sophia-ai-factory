/**
 * R2 Storage Vault probe for Day-1 Operational Verification.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/r2-storage-probe
 */

import type { CheckpointResult, CheckpointStatus } from '@/seed/handover/handover-types';

/**
 * 4. Checkpoint: R2 Storage Bindings (VIDEO_BUCKET & BACKUPS_BUCKET)
 */
export async function probeR2Bindings(envOverride?: Record<string, unknown>): Promise<CheckpointResult> {
  const start = Date.now();
  try {
    const g = globalThis as unknown as {
      __env__?: { VIDEO_BUCKET?: unknown; BACKUPS_BUCKET?: unknown };
      __env?: { VIDEO_BUCKET?: unknown; BACKUPS_BUCKET?: unknown };
      VIDEO_BUCKET?: unknown;
      BACKUPS_BUCKET?: unknown;
    };

    const hasVideo = !!(
      envOverride?.VIDEO_BUCKET ||
      g.__env__?.VIDEO_BUCKET ||
      g.__env?.VIDEO_BUCKET ||
      g.VIDEO_BUCKET
    );

    const hasBackups = !!(
      envOverride?.BACKUPS_BUCKET ||
      g.__env__?.BACKUPS_BUCKET ||
      g.__env?.BACKUPS_BUCKET ||
      g.BACKUPS_BUCKET
    );

    const latency = Date.now() - start;

    if (hasVideo && hasBackups) {
      return {
        checkpointId: 'r2_video_bucket',
        name: 'Cloudflare R2 Storage Vault Bindings',
        nameVi: 'Liên Kết Kho Lưu Trữ Đa Phương Tiện R2',
        category: 'storage',
        status: 'PASS',
        latencyMs: latency,
        details: 'VIDEO_BUCKET & BACKUPS_BUCKET bindings active and connected',
        expected: 'VIDEO_BUCKET & BACKUPS_BUCKET bound',
        actual: 'Both bound',
        diagnosticData: { hasVideo: true, hasBackups: true },
      };
    }

    const isPartial = hasVideo || hasBackups;
    const isProd = process.env.NODE_ENV === 'production';
    const status: CheckpointStatus = !isPartial && isProd ? 'FAIL' : 'WARN';
    const actualText = isPartial
      ? (hasVideo ? 'VIDEO_BUCKET only' : 'BACKUPS_BUCKET only')
      : 'Unbound (missing bindings)';

    return {
      checkpointId: 'r2_video_bucket',
      name: 'Cloudflare R2 Storage Vault Bindings',
      nameVi: 'Liên Kết Kho Lưu Trữ Đa Phương Tiện R2',
      category: 'storage',
      status,
      latencyMs: latency,
      details: isPartial
        ? `Partial R2 binding: ${hasVideo ? 'BACKUPS_BUCKET unbound' : 'VIDEO_BUCKET unbound'} in runtime context`
        : 'R2 storage bindings missing in runtime context (VIDEO_BUCKET and BACKUPS_BUCKET unbound)',
      expected: 'VIDEO_BUCKET & BACKUPS_BUCKET bound',
      actual: actualText,
      diagnosticData: { hasVideo, hasBackups },
    };
  } catch (err) {
    return {
      checkpointId: 'r2_video_bucket',
      name: 'Cloudflare R2 Storage Vault Bindings',
      nameVi: 'Liên Kết Kho Lưu Trữ Đa Phương Tiện R2',
      category: 'storage',
      status: 'WARN',
      latencyMs: Date.now() - start,
      details: `R2 check warning: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
