/**
 * Authoritative 4-Axis Convergence Projector (Gate S1, Gate S5)
 * Layer: tree/convergence (pure domain functions)
 */

import type {
  ConvergenceAxes,
  ConvergenceLedgerRecord,
  CreativeJobStageId,
  ExecutionModeBadge,
} from './convergence-types';

const STAGE_ORDER: Record<CreativeJobStageId, number> = {
  creative_mission_intake: 1, niche_video_plan: 2, script_synthesis: 3, visual_storyboard: 4,
  ceo_approval_gate: 5, media_render_dispatch: 6, media_integrity_verification: 7, channel_delivery_publish: 8,
  delivery_receipt_reconcile: 9, budget_credit_accounting: 10, crash_quarantine_recovery: 11, converged_terminal: 12,
};

export interface ConvergedTruthState {
  isTrulyComplete: boolean;
  isFakeGreenBlocked: boolean;
  requiresHumanReview: boolean;
  overallStatus: 'converged' | 'blocked_verification' | 'blocked_business' | 'human_review_required' | 'failed' | 'in_progress';
  summaryEn: string;
  summaryVi: string;
}

export function canAdvanceStage(from: CreativeJobStageId, to: CreativeJobStageId): boolean {
  if (to === 'crash_quarantine_recovery') return true;
  if (from === 'crash_quarantine_recovery') return to === 'ceo_approval_gate' || to === 'media_render_dispatch';
  return STAGE_ORDER[to] >= STAGE_ORDER[from];
}

export function evaluateConvergedTruth(
  axes: ConvergenceAxes,
  sideEffectUncertain = false,
  hasVerifiedMedia = axes.verificationOutcome === 'verified'
): ConvergedTruthState {
  if (sideEffectUncertain || axes.businessOutcome === 'human_review_required') {
    return {
      isTrulyComplete: false, isFakeGreenBlocked: true, requiresHumanReview: true,
      overallStatus: 'human_review_required',
      summaryEn: 'Human review required: uncertain side-effect or crash quarantine.',
      summaryVi: 'Cần duyệt thủ công: phát hiện crash hoặc tác vụ chưa rõ trạng thái.',
    };
  }
  if (axes.executionOutcome === 'failed' || axes.executionOutcome === 'cancelled' || axes.executionOutcome === 'crashed') {
    return {
      isTrulyComplete: false, isFakeGreenBlocked: false, requiresHumanReview: false,
      overallStatus: 'failed',
      summaryEn: `Execution ${axes.executionOutcome}.`,
      summaryVi: `Thực thi thất bại (${axes.executionOutcome}).`,
    };
  }
  if (axes.executionOutcome === 'succeeded' && (!hasVerifiedMedia || axes.verificationOutcome !== 'verified')) {
    return {
      isTrulyComplete: false, isFakeGreenBlocked: true, requiresHumanReview: false,
      overallStatus: 'blocked_verification',
      summaryEn: 'Blocked fake-green: worker succeeded but media integrity verification did not pass.',
      summaryVi: 'Chặn báo xanh giả: tiến trình chạy xong nhưng kiểm định media chưa đạt.',
    };
  }
  if (axes.businessOutcome === 'rejected' || axes.deliveryOutcome === 'failed') {
    return {
      isTrulyComplete: false, isFakeGreenBlocked: axes.executionOutcome === 'succeeded', requiresHumanReview: false,
      overallStatus: 'blocked_business',
      summaryEn: 'Blocked completion: artifact rejected or delivery failed.',
      summaryVi: 'Chặn hoàn tất: sản phẩm bị từ chối hoặc phân phối thất bại.',
    };
  }
  const allFour =
    axes.executionOutcome === 'succeeded' &&
    axes.verificationOutcome === 'verified' &&
    axes.deliveryOutcome === 'confirmed' &&
    axes.businessOutcome === 'accepted' &&
    hasVerifiedMedia;
  if (allFour) {
    return {
      isTrulyComplete: true, isFakeGreenBlocked: false, requiresHumanReview: false,
      overallStatus: 'converged',
      summaryEn: 'All 4 outcome axes verified and converged.',
      summaryVi: 'Cả 4 trục kết quả đã xác thực và hội tụ hoàn tất.',
    };
  }
  return {
    isTrulyComplete: false, isFakeGreenBlocked: false, requiresHumanReview: false,
    overallStatus: 'in_progress',
    summaryEn: 'Pipeline in progress across convergence axes.',
    summaryVi: 'Tiến trình đang xử lý trên các trục hội tụ.',
  };
}

export function projectMissionAndAffiliateToAxes(input: {
  missionStatus: string; affiliateRunStatus?: string; hasVerifiedMedia?: boolean;
  deliveryConfirmed?: boolean; ceoApproved?: boolean; ceoRejected?: boolean;
}): ConvergenceAxes {
  const execSucceeded = input.missionStatus === 'completed' || input.affiliateRunStatus === 'SUCCEEDED';
  const execFailed = input.missionStatus === 'failed' || input.affiliateRunStatus === 'FAILED';
  return {
    executionOutcome: execFailed ? 'failed' : execSucceeded ? 'succeeded' : 'running',
    verificationOutcome: input.hasVerifiedMedia === true ? 'verified' : input.hasVerifiedMedia === false ? 'failed' : 'pending',
    deliveryOutcome: input.deliveryConfirmed ? 'confirmed' : execSucceeded ? 'dispatched' : 'pending',
    businessOutcome: input.ceoRejected ? 'rejected' : input.missionStatus === 'approval_required' ? 'human_review_required' : input.ceoApproved ? 'accepted' : 'pending',
  };
}

export function describeExecutionBadge(mode: ExecutionModeBadge): {
  mode: ExecutionModeBadge; isFallback: boolean; labelEn: string; labelVi: string;
} {
  const isFallback = mode === 'LOCAL_DETERMINISTIC' || mode === 'CLOUD_FALLBACK' || mode === 'SHADOW';
  const labels: Record<ExecutionModeBadge, { en: string; vi: string }> = {
    LOCAL_DETERMINISTIC: { en: 'Local Deterministic Fallback', vi: 'Chế độ Mô phỏng Nội bộ (Fallback)' },
    SHADOW: { en: 'Shadow Contract Verification', vi: 'Chế độ Đối chiếu Ngầm (Shadow)' },
    LOCAL_TEST: { en: 'Verified Local SQLite Bridge', vi: 'Cầu nối SQLite Mekong Thực tế' },
    MEKONG_ENABLED: { en: 'Mekong Autonomous Worker v1', vi: 'Mekong Worker Tự hành v1' },
    CLOUD_FALLBACK: { en: 'Cloud Provider Fallback', vi: 'Dự phòng Đám mây (Fallback)' },
  };
  return { mode, isFallback, labelEn: labels[mode].en, labelVi: labels[mode].vi };
}

export type { ConvergenceLedgerRecord };
