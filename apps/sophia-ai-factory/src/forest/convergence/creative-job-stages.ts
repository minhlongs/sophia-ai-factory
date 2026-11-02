/**
 * 12-Stage Creative Job Stage Definitions & Deterministic Evaluators (Gate S5, Supreme #02.1 P3)
 *
 * Layer: forest/convergence (imports seed and tree only — zero land imports)
 */

import type {
  ArtifactManifestEntry,
  CreativeJobStageId,
  MediaVerificationReport,
} from '@/tree/convergence';
import { verifyDiskBackedArtifactManifest } from './local-artifact-materializer';

export interface CreativeStageDefinition {
  stageId: CreativeJobStageId;
  order: number;
  labelEn: string;
  labelVi: string;
  producesArtifactKind?: ArtifactManifestEntry['kind'];
  costUsd: number;
}

export const CREATIVE_JOB_12_STAGES: readonly CreativeStageDefinition[] = [
  { stageId: 'creative_mission_intake', order: 1, labelEn: 'Creative Mission Intake', labelVi: 'Tiếp nhận Nhiệm vụ Sáng tạo', costUsd: 0.02 },
  { stageId: 'niche_video_plan', order: 2, labelEn: 'Niche Video Plan', labelVi: 'Kế hoạch Video theo Ngách', producesArtifactKind: 'plan', costUsd: 0.05 },
  { stageId: 'script_synthesis', order: 3, labelEn: 'Script Synthesis', labelVi: 'Tổng hợp Kịch bản Song ngữ', producesArtifactKind: 'script', costUsd: 0.08 },
  { stageId: 'visual_storyboard', order: 4, labelEn: 'Visual Storyboard', labelVi: 'Phân cảnh Hình ảnh', producesArtifactKind: 'visual', costUsd: 0.1 },
  { stageId: 'ceo_approval_gate', order: 5, labelEn: 'CEO Approval Gate', labelVi: 'Cổng Phê duyệt CEO', costUsd: 0 },
  { stageId: 'media_render_dispatch', order: 6, labelEn: 'Media Render Dispatch', labelVi: 'Điều phối Kết xuất Video', producesArtifactKind: 'video', costUsd: 0.45 },
  { stageId: 'media_integrity_verification', order: 7, labelEn: 'Media Integrity Verification', labelVi: 'Kiểm định Toàn vẹn Media', costUsd: 0.02 },
  { stageId: 'channel_delivery_publish', order: 8, labelEn: 'Channel Delivery Publish', labelVi: 'Xuất bản Đa kênh', costUsd: 0.03 },
  { stageId: 'delivery_receipt_reconcile', order: 9, labelEn: 'Delivery Receipt Reconcile', labelVi: 'Đối soát Biên nhận Phân phối', producesArtifactKind: 'receipt', costUsd: 0.01 },
  { stageId: 'budget_credit_accounting', order: 10, labelEn: 'Budget & Credit Accounting', labelVi: 'Hạch toán Ngân sách & Tín dụng', costUsd: 0.01 },
  { stageId: 'crash_quarantine_recovery', order: 11, labelEn: 'Crash Quarantine Recovery', labelVi: 'Cách ly & Khôi phục Sự cố', costUsd: 0 },
  { stageId: 'converged_terminal', order: 12, labelEn: 'Converged Terminal', labelVi: 'Hội tụ Hoàn tất 4 Trục', costUsd: 0 },
] as const;

export function buildDeterministicStageArtifact(
  jobId: string,
  stageId: CreativeJobStageId,
  kind: ArtifactManifestEntry['kind'],
  corruptMedia = false
): ArtifactManifestEntry {
  const hexSeed = Array.from(`${jobId}:${stageId}:${kind}`)
    .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    .toString(16)
    .replace('-', 'f')
    .padStart(8, '0');
  const sha256 = corruptMedia && kind === 'video' ? 'INVALID_HASH' : hexSeed.repeat(8).slice(0, 64);
  return {
    artifactId: `art_${jobId}_${stageId}`,
    stageId,
    kind,
    sha256,
    sizeBytes: corruptMedia && kind === 'video' ? 0 : 4096,
    uri: `r2://sophia-artifacts/${jobId}/${stageId}.${kind === 'video' ? 'mp4' : 'json'}`,
    mimeType: kind === 'video' ? 'video/mp4' : 'application/json',
    verified: !corruptMedia || kind !== 'video',
  };
}

export function verifyMediaArtifactManifest(
  manifest: ArtifactManifestEntry[],
  verificationAttemptId = 'verif_att_1'
): MediaVerificationReport {
  if (manifest.some((a) => Boolean(a.localFilePath))) {
    return verifyDiskBackedArtifactManifest(manifest, verificationAttemptId);
  }
  const videoEntries = manifest.filter((a) => a.kind === 'video');
  if (videoEntries.length === 0) {
    return {
      hasVerifiedMedia: false,
      checkedCount: manifest.length,
      passedCount: 0,
      checksumMatched: false,
      durationValid: false,
      verificationAttemptId,
      failureReason: 'Missing rendered video artifact in manifest',
    };
  }
  const sha256Re = /^[a-f0-9]{64}$/i;
  const passed = videoEntries.filter((v) => v.verified && v.sizeBytes > 0 && sha256Re.test(v.sha256));
  const allValid = passed.length === videoEntries.length;
  return {
    hasVerifiedMedia: allValid,
    checkedCount: videoEntries.length,
    passedCount: passed.length,
    checksumMatched: allValid,
    durationValid: allValid,
    verificationAttemptId,
    failureReason: allValid ? undefined : 'Rendered video failed SHA-256 or byte-length integrity check',
  };
}
