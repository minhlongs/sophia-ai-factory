'use client';

/**
 * ConvergenceOutcomeStrip — Bilingual 4-Axis Truth & Unit Economics Strip (Gate S7, Gate S8)
 *
 * Surfaces:
 * - 4 independent outcome axes (Execution, Verification, Delivery, Business)
 * - Honest Execution Mode Badge (with explicit fallback disclosure)
 * - Crash Recovery Alert (`HUMAN_REVIEW_REQUIRED` + preserved quarantine path)
 * - 5 Unit-Economics Metrics (`costPerVerifiedJob`, `costPerAcceptedArtifact`,
 *   `verificationYield`, `businessAcceptanceYield`, `retryOverhead`)
 */

import React from 'react';
import type { WorkflowConvergenceView } from '@/tree/mission/workflow-convergence-enricher';

export interface ConvergenceOutcomeStripProps {
  convergence: WorkflowConvergenceView;
  locale?: 'vi' | 'en';
}

export function ConvergenceOutcomeStrip({
  convergence,
  locale = 'vi',
}: ConvergenceOutcomeStripProps) {
  const isVi = locale === 'vi';
  const { axes, executionBadge, crashRecoveryAlert, unitEconomics, truthState } = convergence;

  return (
    <div
      data-testid="convergence-outcome-strip"
      className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/60 p-3.5 space-y-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-slate-900 dark:text-white">
          {isVi ? 'Hội tụ 4 Trục Độc lập:' : '4-Axis Convergence Truth:'}{' '}
          <span className="font-mono text-indigo-600 dark:text-indigo-300">
            {isVi ? truthState.summaryVi : truthState.summaryEn}
          </span>
        </span>
        <span
          data-testid="execution-mode-badge"
          data-fallback={String(executionBadge.isFallback)}
          className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-300"
        >
          {isVi ? executionBadge.labelVi : executionBadge.labelEn}
          {executionBadge.isFallback ? (isVi ? ' [Dự phòng]' : ' [Fallback]') : ''}
        </span>
      </div>

      {crashRecoveryAlert.active && (
        <div
          data-testid="crash-recovery-alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 font-mono text-rose-700 dark:text-rose-300"
        >
          {isVi ? crashRecoveryAlert.messageVi : crashRecoveryAlert.messageEn}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-2">
          <div className="text-[10px] text-slate-500">{isVi ? '1. Thực thi (Exec)' : '1. Execution'}</div>
          <div className="font-semibold text-slate-900 dark:text-white">{axes.executionOutcome}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-2">
          <div className="text-[10px] text-slate-500">{isVi ? '2. Kiểm định (Verify)' : '2. Verification'}</div>
          <div className="font-semibold text-slate-900 dark:text-white">{axes.verificationOutcome}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-2">
          <div className="text-[10px] text-slate-500">{isVi ? '3. Phân phối (Deliver)' : '3. Delivery'}</div>
          <div className="font-semibold text-slate-900 dark:text-white">{axes.deliveryOutcome}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-2">
          <div className="text-[10px] text-slate-500">{isVi ? '4. Nghiệm thu (Biz)' : '4. Business'}</div>
          <div className="font-semibold text-slate-900 dark:text-white">{axes.businessOutcome}</div>
        </div>
      </div>

      <div
        data-testid="unit-economics-strip"
        className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-white/10 font-mono text-[11px] text-slate-600 dark:text-slate-300"
      >
        <span>{isVi ? 'Chi phí/Job chuẩn' : 'Cost/Verified Job'}: ${unitEconomics.costPerVerifiedJob}</span>
        <span>{isVi ? 'Chi phí/Video duyệt' : 'Cost/Accepted Art.'}: ${unitEconomics.costPerAcceptedArtifact}</span>
        <span>{isVi ? 'Tỷ lệ kiểm định' : 'Verify Yield'}: {(unitEconomics.verificationYield * 100).toFixed(0)}%</span>
        <span>{isVi ? 'Tỷ lệ CEO duyệt' : 'Accept Yield'}: {(unitEconomics.businessAcceptanceYield * 100).toFixed(0)}%</span>
        <span>{isVi ? 'Chi phí chạy lại' : 'Retry Overhead'}: {(unitEconomics.retryOverhead * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
