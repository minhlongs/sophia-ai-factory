'use client';

/**
 * Interactive Visual Pipeline Node Map (n8n / Figma-style DAG Canvas for Non-Tech CEOs).
 *
 * Renders 5 connected live-status workflow nodes on a subtle dotted canvas grid:
 * [1. BYOK & Offer] -> [2. Script & Eval] -> [3. Voice & MP4] -> [4. GEO & 5-Sàn] -> [5. Clicks & Revenue]
 * Clicking any node switches directly to its owning R&D Studio tab with zero drag-and-drop friction.
 *
 * @module components/first-value/affiliate-studio/rd-studio-pipeline-canvas
 */

import { useTranslations } from 'next-intl';
import { KeyRound, Sparkles, Film, Share2, BarChart3 } from 'lucide-react';
import type { RdStudioTabId } from './rd-studio-workspace-bar';

export interface RdStudioPipelineCanvasProps {
  readonly activeTab: RdStudioTabId;
  readonly onSelectTab: (tab: RdStudioTabId) => void;
  readonly byokConfigured: boolean;
  readonly offersCount: number;
  readonly campaignsCount: number;
  readonly hasApprovedCampaign: boolean;
  readonly mp4Count: number;
  readonly linksCount: number;
  readonly verifiedClicks: number;
  readonly manualPublishesCount: number;
}

export function RdStudioPipelineCanvas(props: RdStudioPipelineCanvasProps) {
  const t = useTranslations('firstValue');

  const nodes = [
    {
      id: 'node-setup',
      step: '01',
      tab: 'setup' as const,
      title: t('rdNode1Title'),
      metric: `${props.byokConfigured ? 'BYOK ✓' : 'BYOK !'} · ${props.offersCount} offer`,
      done: props.byokConfigured && props.offersCount > 0,
      Icon: KeyRound,
    },
    {
      id: 'node-script',
      step: '02',
      tab: 'script' as const,
      title: t('rdNode2Title'),
      metric: `${props.campaignsCount} camp · ${props.hasApprovedCampaign ? 'APPROVED' : 'DRAFT'}`,
      done: props.hasApprovedCampaign,
      Icon: Sparkles,
    },
    {
      id: 'node-media',
      step: '03',
      tab: 'studio' as const,
      title: t('rdNode3Title'),
      metric: `${props.mp4Count} MP4`,
      done: props.mp4Count > 0,
      Icon: Film,
    },
    {
      id: 'node-dist',
      step: '04',
      tab: 'studio' as const,
      title: t('rdNode4Title'),
      metric: `${props.linksCount} link · GEO`,
      done: props.linksCount > 0,
      Icon: Share2,
    },
    {
      id: 'node-rev',
      step: '05',
      tab: 'ops' as const,
      title: t('rdNode5Title'),
      metric: `${props.verifiedClicks} clicks · ${props.manualPublishesCount} post`,
      done: props.manualPublishesCount > 0 || props.verifiedClicks > 0,
      Icon: BarChart3,
    },
  ] as const;

  const firstPendingIdx = nodes.findIndex((n) => !n.done);

  return (
    <section
      aria-label={t('rdCanvasLabel')}
      data-testid="rd-studio-pipeline-canvas"
      className="overflow-x-auto rounded-xl border border-border bg-card p-4"
      style={{
        backgroundImage:
          'radial-gradient(circle, color-mix(in srgb, currentColor 12%, transparent) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          {t('rdCanvasLabel')}
        </span>
        <span className="font-mono text-muted-foreground">{t('rdCanvasHint')}</span>
      </div>

      <div className="flex min-w-[740px] items-center justify-between gap-1">
        {nodes.map((node, idx) => {
          const isCurrent = idx === firstPendingIdx;
          const isSelected = props.activeTab === node.tab;
          const Icon = node.Icon;

          return (
            <div key={node.id} className="flex flex-1 items-center">
              <button
                type="button"
                data-testid={node.id}
                onClick={() => props.onSelectTab(node.tab)}
                className={`group flex w-full flex-col gap-1.5 rounded-xl border bg-background/95 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : node.done
                      ? 'border-emerald-500/40'
                      : isCurrent
                        ? 'border-amber-500/50'
                        : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    NODE {node.step}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      node.done
                        ? 'bg-emerald-500'
                        : isCurrent
                          ? 'animate-pulse bg-amber-500'
                          : 'bg-muted-foreground/40'
                    }`}
                  />
                </div>
                <div className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                  {node.title}
                </div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">
                  {node.metric}
                </div>
              </button>

              {idx < nodes.length - 1 && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 28 16"
                  className="h-4 w-7 shrink-0 text-muted-foreground/60"
                >
                  <line
                    x1="2"
                    y1="8"
                    x2="20"
                    y2="8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray={node.done ? undefined : '3 2'}
                  />
                  <polyline
                    points="16,4 22,8 16,12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
