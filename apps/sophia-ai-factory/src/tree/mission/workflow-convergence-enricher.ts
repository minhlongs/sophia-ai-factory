/**
 * Pure Convergence & Unit-Economics Enricher for Operator Workflow Views (Gate S7, Gate S8)
 *
 * Layer: tree/mission (pure TypeScript — safe for 'use client' imports)
 */

import {
  describeExecutionBadge,
  evaluateConvergedTruth,
  type ConvergenceAxes,
  type ConvergenceLedgerRecord,
  type ConvergedTruthState,
  type ExecutionModeBadge,
  type UnitEconomicsSummary,
} from '@/tree/convergence';

export interface WorkflowConvergenceView {
  axes: ConvergenceAxes;
  truthState: ConvergedTruthState;
  executionBadge: {
    mode: ExecutionModeBadge;
    isFallback: boolean;
    labelEn: string;
    labelVi: string;
  };
  crashRecoveryAlert: {
    active: boolean;
    status: 'HUMAN_REVIEW_REQUIRED' | 'CLEAR';
    preservedPath: string | null;
    messageEn: string;
    messageVi: string;
  };
  unitEconomics: UnitEconomicsSummary;
}

export function buildDefaultWorkflowConvergenceView(
  mode: ExecutionModeBadge = 'LOCAL_DETERMINISTIC'
): WorkflowConvergenceView {
  const axes: ConvergenceAxes = {
    executionOutcome: 'running',
    verificationOutcome: 'pending',
    deliveryOutcome: 'pending',
    businessOutcome: 'pending',
  };
  return {
    axes,
    truthState: evaluateConvergedTruth(axes, false, false),
    executionBadge: describeExecutionBadge(mode),
    crashRecoveryAlert: {
      active: false,
      status: 'CLEAR',
      preservedPath: null,
      messageEn: 'No crash quarantine active.',
      messageVi: 'Không có tiến trình cần cách ly.',
    },
    unitEconomics: {
      costPerVerifiedJob: 0,
      costPerAcceptedArtifact: 0,
      verificationYield: 0,
      businessAcceptanceYield: 0,
      retryOverhead: 0,
    },
  };
}

export function enrichWorkflowConvergenceFromRecord(
  record: ConvergenceLedgerRecord,
  unitEconomics: UnitEconomicsSummary
): WorkflowConvergenceView {
  const axes: ConvergenceAxes = {
    executionOutcome: record.executionOutcome,
    verificationOutcome: record.verificationOutcome,
    deliveryOutcome: record.deliveryOutcome,
    businessOutcome: record.businessOutcome,
  };
  const truthState = evaluateConvergedTruth(
    axes,
    record.sideEffectUncertain,
    record.verificationReport.hasVerifiedMedia
  );
  const crashActive =
    record.sideEffectUncertain || record.lifecycleStage === 'crash_quarantine_recovery';

  return {
    axes,
    truthState,
    executionBadge: describeExecutionBadge(record.executionMode),
    crashRecoveryAlert: {
      active: crashActive,
      status: crashActive ? 'HUMAN_REVIEW_REQUIRED' : 'CLEAR',
      preservedPath: record.crashPreservedPath,
      messageEn: crashActive
        ? `HUMAN_REVIEW_REQUIRED — Crash artifacts preserved at ${record.crashPreservedPath ?? 'quarantine'}`
        : 'No crash quarantine active.',
      messageVi: crashActive
        ? `CẦN DUYỆT THỦ CÔNG — Đã lưu trữ hiện trường crash tại ${record.crashPreservedPath ?? 'quarantine'}`
        : 'Không có tiến trình cần cách ly.',
    },
    unitEconomics,
  };
}
