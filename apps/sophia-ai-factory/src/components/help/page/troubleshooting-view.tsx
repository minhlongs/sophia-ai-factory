'use client';

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { HelpData } from './types';

interface TroubleshootingViewProps {
  data: HelpData;
  isVi: boolean;
}

export function TroubleshootingView({ data, isVi }: TroubleshootingViewProps) {
  const severityStyles = {
    high: { bg: 'bg-red-950/20', border: 'border-red-900/40' },
    medium: { bg: 'bg-amber-950/20', border: 'border-amber-900/40' },
    low: { bg: 'bg-muted-900/40', border: 'border-border-800' },
  };

  const severityLabels = isVi
    ? { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }
    : { high: 'High', medium: 'Medium', low: 'Low' };

  return (
    <div className="space-y-4">
      {data.issues?.map((issue, i) => {
        const style = severityStyles[issue.severity];
        return (
          <div key={i} className={`rounded-xl border ${style.border} ${style.bg} p-5 space-y-3`}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-muted-foreground-100">{issue.symptom}</h2>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted-800 border border-border-700 text-muted-foreground-300">
                    {severityLabels[issue.severity]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground-400 leading-relaxed">
                  <span className="text-muted-foreground-500">{isVi ? 'Nguyên nhân: ' : 'Cause: '}</span>
                  {issue.cause}
                </p>
              </div>
            </div>

            <ol className="pl-11 space-y-1.5">
              {issue.steps.map((step, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {issue.followUp && (
              <div className="pl-11">
                <a
                  href={issue.followUp.href}
                  className="inline-block mt-1 text-xs px-3 py-1.5 bg-muted-800 hover:bg-muted-700 text-primary-300 rounded-lg transition-colors"
                >
                  {issue.followUp.label} →
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
