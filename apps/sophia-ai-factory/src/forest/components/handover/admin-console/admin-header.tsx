/**
 * Admin Console Submodule: Header and Action Toolbar.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/admin-header
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, RefreshCw, Play, Layers, Download, X } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

interface AdminHeaderProps {
  isVerifying: boolean;
  isDrilling: boolean;
  isExportingEnv: boolean;
  exportNotice: string | null;
  onDismissExportNotice: () => void;
  onRunVerification: () => void;
  onRunDrDrill: () => void;
  onExportEnv: () => void;
}

export function AdminHeader({
  isVerifying,
  isDrilling,
  isExportingEnv,
  exportNotice,
  onDismissExportNotice,
  onRunVerification,
  onRunDrDrill,
  onExportEnv,
}: AdminHeaderProps) {
  const t = useTranslations('admin.handover');

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              OPERATOR COCKPIT
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Phase 20 Closeout Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRunVerification}
            disabled={isVerifying}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all',
              isVerifying
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.01]',
            )}
          >
            {isVerifying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            {isVerifying ? t('actions.runningVerification') : t('actions.runVerification')}
          </button>

          <button
            type="button"
            onClick={onRunDrDrill}
            disabled={isDrilling}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-all"
          >
            {isDrilling ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-primary" />
            )}
            {isDrilling ? t('actions.runningDrill') : t('actions.runDrill')}
          </button>

          <button
            type="button"
            onClick={onExportEnv}
            disabled={isExportingEnv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingEnv ? t('actions.exportingEnv') : t('actions.exportEnv')}
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-between">
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={onDismissExportNotice}
            aria-label={t('actions.dismiss') || 'Dismiss'}
            className="p-1 hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
