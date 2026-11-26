'use client';

/**
 * Calm Inline Pipeline Header (Linear / Vercel Geist 2026 Craft Standard).
 *
 * Replaces stacked nav bars, heavy boxed pipeline canvases, and duplicate steppers
 * with one quiet, hairline-bordered inline breadcrumb bar (`48px` height).
 *
 * @module components/first-value/affiliate-studio/rd-studio-workspace-bar
 */

import { useTranslations } from 'next-intl';
import { Check, ChevronRight, LayoutGrid } from 'lucide-react';

export type RdStudioTabId = 'setup' | 'script' | 'studio' | 'ops' | 'all';

export interface RdStudioWorkspaceBarProps {
  readonly activeTab: RdStudioTabId;
  readonly onTabChange: (tab: RdStudioTabId) => void;
  readonly byokConfigured: boolean;
  readonly activeOfferName: string | null;
  readonly activeCampaignTitle: string | null;
  readonly offersCount: number;
  readonly campaignsCount: number;
  readonly hasApprovedCampaign?: boolean;
  readonly hasMp4OrLink?: boolean;
  readonly hasManualPublish?: boolean;
}

export function RdStudioWorkspaceBar(props: RdStudioWorkspaceBarProps) {
  const t = useTranslations('firstValue');

  const steps: ReadonlyArray<{
    readonly id: Exclude<RdStudioTabId, 'all'>;
    readonly label: string;
    readonly done: boolean;
  }> = [
    {
      id: 'setup',
      label: t('rdTabSetupOffers'),
      done: props.byokConfigured && props.offersCount > 0,
    },
    {
      id: 'script',
      label: t('rdTabScriptEval'),
      done: Boolean(props.hasApprovedCampaign),
    },
    {
      id: 'studio',
      label: t('rdTabVideoDist'),
      done: Boolean(props.hasMp4OrLink),
    },
    {
      id: 'ops',
      label: t('rdTabRevenueOps'),
      done: Boolean(props.hasManualPublish),
    },
  ];

  return (
    <div
      data-testid="rd-studio-workspace-bar"
      className="sticky top-12 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div
        role="tablist"
        aria-label={t('rdStudioModeBadge')}
        className="flex flex-wrap items-center gap-1"
      >
        {steps.map((step, idx) => {
          const isActive = props.activeTab === step.id;
          return (
            <div key={step.id} className="flex items-center gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`rd-studio-tab-${step.id}`}
                onClick={() => props.onTabChange(step.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-muted font-semibold text-foreground'
                    : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                  />
                )}
                <span>{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={`font-mono text-[11px] ${
            props.byokConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          BYOK: {props.byokConfigured ? 'READY' : 'REQUIRED'}
        </span>
        {props.activeOfferName && (
          <span className="hidden max-w-[140px] truncate text-[11px] text-muted-foreground md:inline">
            · {props.activeOfferName}
          </span>
        )}
        <button
          type="button"
          data-testid="rd-studio-tab-all"
          aria-pressed={props.activeTab === 'all'}
          onClick={() => props.onTabChange(props.activeTab === 'all' ? 'setup' : 'all')}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            props.activeTab === 'all'
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <LayoutGrid className="h-3 w-3" />
          <span>{t('rdTabAllView')}</span>
        </button>
      </div>
    </div>
  );
}
