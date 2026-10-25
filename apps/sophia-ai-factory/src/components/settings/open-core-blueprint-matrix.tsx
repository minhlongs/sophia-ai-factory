/** Displays catalog documentation coverage, not implementation readiness. */
'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { BookOpen, ChevronDown, ChevronUp, GitBranch, Hash } from 'lucide-react';
import type { OpenCore25StepCatalogReport } from '@/tree/open-core/open-core-25-steps-auditor';
import { getBinhPhapThienForStep } from '@/seed/config/open-core-25-steps-binh-phap-map';

export interface OpenCoreBlueprintMatrixProps {
  readonly audit: OpenCore25StepCatalogReport | null | undefined;
}

const SCOPE_BADGE_STYLES: Record<string, string> = {
  COMMUNITY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  CLOUD_SAAS: 'bg-primary/15 text-primary border-primary/30',
  ENTERPRISE_MASTER: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  HYBRID: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

export function OpenCoreBlueprintMatrix({ audit }: OpenCoreBlueprintMatrixProps) {
  const locale = useLocale();
  const isVietnamese = locale === 'vi';
  const [expandedPhase, setExpandedPhase] = useState<string | null>('phase_1_foundation');

  if (!audit) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 dark:border-white/[0.08] dark:bg-[#11131F]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground dark:text-white">
            <GitBranch className="h-4 w-4 text-primary" />
            <span>{isVietnamese ? 'Danh mục Open-Core 25 bước' : '25-Step Open-Core Catalog'}</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isVietnamese ? 'Đã mô tả' : 'Documented'} {audit.documentedSteps}/{audit.totalSteps}{' '}
            {isVietnamese ? 'mục' : 'entries'} ({audit.catalogCompletenessPercentage}%) ·{' '}
            {audit.communityFeatureCount} Community · {audit.cloudSaasFeatureCount} Cloud SaaS ·{' '}
            {audit.enterpriseMasterFeatureCount} Enterprise/Master
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isVietnamese
              ? 'Mức độ đầy đủ của mô tả danh mục; không xác nhận công việc đã triển khai.'
              : 'Catalog documentation coverage; this does not confirm implementation or deployment.'}
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
          title={audit.catalogFingerprintHex}
        >
          <Hash className="h-3.5 w-3.5" />
          <span>{isVietnamese ? 'Dấu vân tay SHA-256' : 'Catalog SHA-256'}: {audit.catalogFingerprintHex.slice(0, 12)}…</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {audit.phases.map((phase) => {
          const isOpen = expandedPhase === phase.phaseId;
          const detailsId = `open-core-${phase.phaseId}-details`;
          return (
            <div key={phase.phaseId} className="overflow-hidden rounded-xl border border-border bg-background/50 dark:border-white/[0.08] dark:bg-black/20">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={detailsId}
                onClick={() => setExpandedPhase(isOpen ? null : phase.phaseId)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-foreground transition hover:bg-muted/40 dark:text-white"
              >
                <span>
                  {isVietnamese ? phase.titleVi : phase.titleEn}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    ({phase.documentedSteps}/{phase.totalSteps} {isVietnamese ? 'mục đã mô tả' : 'entries documented'})
                  </span>
                </span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {isOpen && (
                <div id={detailsId} className="divide-y divide-border border-t border-border dark:divide-white/[0.06] dark:border-white/[0.06]">
                  {phase.steps.map((step) => {
                    const thiên = getBinhPhapThienForStep(step);
                    return (
                    <div key={step.step} className="flex items-start justify-between gap-3 px-4 py-2.5 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground dark:text-slate-100">
                          <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span>#{step.step} {isVietnamese ? step.titleVi : step.titleEn}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {isVietnamese ? `Quy tắc kinh doanh (EN): ${step.businessRule}` : step.businessRule}
                        </p>
                        <p className="font-mono text-[10px] text-primary">
                          {isVietnamese ? 'Tài liệu tham chiếu:' : 'Reference:'} {step.verificationArtifact}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                        title={
                          thiên
                            ? isVietnamese
                              ? `Binh Pháp thiên ${thiên.number} — ${thiên.titleVi}`
                              : `Art of War chapter ${thiên.number} — ${thiên.titleEn}`
                            : undefined
                        }
                      >
                        {thiên ? `${thiên.hanzi}` : '—'}
                      </span>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${SCOPE_BADGE_STYLES[step.editionScope] ?? SCOPE_BADGE_STYLES.HYBRID}`}>
                        {step.editionScope}
                      </span>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
