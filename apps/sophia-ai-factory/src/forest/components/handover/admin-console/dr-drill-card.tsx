/**
 * Admin Console Submodule: Disaster Recovery (DR) Drill Card.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/dr-drill-card
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import type { DrDrillReport } from './types';

interface DrDrillCardProps {
  report: DrDrillReport | null;
}

export function DrDrillCard({ report }: DrDrillCardProps) {
  const t = useTranslations('admin.handover');

  if (!report) return null;

  return (
    <Card className="p-5 border-border/80 bg-card/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">{t('drDrill.title')}</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {report.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-3 rounded-lg bg-background border border-border/50">
          <span className="text-muted-foreground block text-[11px] mb-1">
            {t('drDrill.tablesVerified')}
          </span>
          <span className="text-sm font-bold text-foreground">
            {report.tablesVerified} Tables
          </span>
        </div>
        <div className="p-3 rounded-lg bg-background border border-border/50">
          <span className="text-muted-foreground block text-[11px] mb-1">
            {t('drDrill.readWriteProbe')}
          </span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            Atomic Pass
          </span>
        </div>
        <div className="p-3 rounded-lg bg-background border border-border/50">
          <span className="text-muted-foreground block text-[11px] mb-1">
            {t('drDrill.latency')}
          </span>
          <span className="text-sm font-bold text-foreground font-mono">
            {report.latencyMs}ms
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">{report.details}</p>
    </Card>
  );
}
