/**
 * Admin Console Submodule: Verification Report Panel.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/verification-report-panel
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, XCircle, Check } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';
import type { VerificationRunReport } from '@/seed/handover/handover-types';

interface VerificationReportPanelProps {
  report: VerificationRunReport | null;
  error: string | null;
}

export function VerificationReportPanel({ report, error }: VerificationReportPanelProps) {
  const t = useTranslations('admin.handover');

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!report) return null;

  return (
    <Card className="p-6 border-2 border-primary/20 shadow-md bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider',
                report.overallVerdict === 'PASS'
                  ? 'bg-emerald-500 text-white'
                  : report.overallVerdict === 'WARN'
                    ? 'bg-amber-500 text-white'
                    : 'bg-destructive text-destructive-foreground',
              )}
            >
              {report.overallVerdict}
            </span>
            <h3 className="text-base font-bold text-foreground">
              {t('verification.title')}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Run ID: {report.runId} • Duration: {report.durationMs}ms • Commit SHA: {report.deployedSha}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {report.passedCount} {t('verification.passed')}
          </span>
          {report.warningCount > 0 && (
            <span className="text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {report.warningCount} {t('verification.warnings')}
            </span>
          )}
          {report.failedCount > 0 && (
            <span className="text-destructive flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              {report.failedCount} {t('verification.failed')}
            </span>
          )}
        </div>
      </div>

      {/* 11 Checkpoints Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
            <tr>
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">{t('verification.checkpoint')}</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">{t('verification.status')}</th>
              <th className="py-2.5 px-3">{t('verification.latency')}</th>
              <th className="py-2.5 px-3">{t('verification.details')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {report.checkpoints.map((cp, idx) => (
              <tr key={cp.checkpointId || idx} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                <td className="py-2.5 px-3 font-semibold text-foreground">{cp.name}</td>
                <td className="py-2.5 px-3 capitalize text-muted-foreground">{cp.category}</td>
                <td className="py-2.5 px-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold',
                      cp.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : cp.status === 'WARN'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20',
                    )}
                  >
                    {cp.status === 'PASS' && <Check className="w-3 h-3" />}
                    {cp.status === 'WARN' && <AlertTriangle className="w-3 h-3" />}
                    {cp.status === 'FAIL' && <XCircle className="w-3 h-3" />}
                    {cp.status}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground">{cp.latencyMs}ms</td>
                <td className="py-2.5 px-3 text-muted-foreground max-w-md truncate" title={cp.details}>
                  {cp.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
