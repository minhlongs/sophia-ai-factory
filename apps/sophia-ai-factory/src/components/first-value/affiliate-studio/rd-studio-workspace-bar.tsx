'use client';

/**
 * Sticky R&D Studio Context Bar & 4-Tab Modular Workspace Switcher (Zen Design OS 2026).
 *
 * Replaces vertical 11-card scroll fatigue with 4 focused workspaces:
 * 1. Setup & Offers (BYOK + Crypto/SaaS Offers)
 * 2. Script & Eval (AI Generator 9:16/16:9 + Content Workspace)
 * 3. Video & Distribution (MP4/TTS/SRT/1-Long-3-Shorts + 5-Platform Hub)
 * 4. Revenue & R&D Ops (Revenue Ledger + Feedback + Support)
 * Plus an optional "All View" toggle for full-page overview.
 *
 * @module components/first-value/affiliate-studio/rd-studio-workspace-bar
 */

import { useTranslations } from 'next-intl';
import { Layers, Sparkles, Film, BarChart3, LayoutGrid } from 'lucide-react';

export type RdStudioTabId = 'setup' | 'script' | 'studio' | 'ops' | 'all';

export interface RdStudioWorkspaceBarProps {
  readonly activeTab: RdStudioTabId;
  readonly onTabChange: (tab: RdStudioTabId) => void;
  readonly byokConfigured: boolean;
  readonly activeOfferName: string | null;
  readonly activeCampaignTitle: string | null;
  readonly offersCount: number;
  readonly campaignsCount: number;
}

export function RdStudioWorkspaceBar(props: RdStudioWorkspaceBarProps) {
  const t = useTranslations('firstValue');

  const tabs: ReadonlyArray<{
    readonly id: Exclude<RdStudioTabId, 'all'>;
    readonly label: string;
    readonly badge?: string;
    readonly Icon: typeof Layers;
  }> = [
    {
      id: 'setup',
      label: t('rdTabSetupOffers'),
      badge: props.offersCount > 0 ? String(props.offersCount) : undefined,
      Icon: Layers,
    },
    {
      id: 'script',
      label: t('rdTabScriptEval'),
      badge: props.campaignsCount > 0 ? String(props.campaignsCount) : undefined,
      Icon: Sparkles,
    },
    {
      id: 'studio',
      label: t('rdTabVideoDist'),
      Icon: Film,
    },
    {
      id: 'ops',
      label: t('rdTabRevenueOps'),
      Icon: BarChart3,
    },
  ];

  return (
    <div
      data-testid="rd-studio-workspace-bar"
      className="sticky top-[57px] z-20 space-y-3 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur"
    >
      {/* Top Context Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t('rdStudioModeBadge')}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
              props.byokConfigured
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            BYOK: {props.byokConfigured ? 'READY' : 'REQUIRED'}
          </span>
          {props.activeOfferName && (
            <span className="hidden max-w-[200px] truncate rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground md:inline">
              Offer: <strong className="text-foreground">{props.activeOfferName}</strong>
            </span>
          )}
          {props.activeCampaignTitle && (
            <span className="hidden max-w-[220px] truncate rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground lg:inline">
              Campaign: <strong className="text-foreground">{props.activeCampaignTitle}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="rd-studio-tab-all"
          aria-pressed={props.activeTab === 'all'}
          onClick={() => props.onTabChange(props.activeTab === 'all' ? 'setup' : 'all')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            props.activeTab === 'all'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>{t('rdTabAllView')}</span>
        </button>
      </div>

      {/* 4-Tab Modular Navigation */}
      <div
        role="tablist"
        aria-label={t('rdStudioModeBadge')}
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
      >
        {tabs.map(({ id, label, badge, Icon }) => {
          const isActive = props.activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`rd-studio-tab-${id}`}
              onClick={() => props.onTabChange(id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
              {badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
