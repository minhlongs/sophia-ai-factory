/**
 * guide-workbench.tsx
 * Shell of the guide workbench: owns the hash store, the mode switch, the
 * keyboard bindings and the two-column grid. Both children receive the single
 * active target as a prop, so the canvas and the inspector never disagree.
 */

'use client';

// i18n-namespace: guide

import { useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GUIDE_BACKEND_STATS, crossPeer, type GuideActiveTarget } from '@/seed/guide';
import { useGuideHashState } from './use-guide-hash-state';
import { GuideSchematicCanvas } from './guide-schematic-canvas';
import { GuideFocusedInspector, type GuideMode } from './guide-focused-inspector';
import { buildCanvasLabels, buildInspectorLabels } from './guide-workbench-labels';

const TABS: readonly { readonly mode: GuideMode; readonly key: string }[] = [
  { mode: 'stage', key: 'modePipeline' },
  { mode: 'pillar', key: 'modePillars' },
];

/** Stable id linking the tablist to the inspector panel for assistive tech. */
const PANEL_ID = 'guide-inspector-panel';

const STATS: readonly { readonly value: number; readonly key: string }[] = [
  { value: GUIDE_BACKEND_STATS.apiRoutesCount, key: 'statApis' },
  { value: GUIDE_BACKEND_STATS.inngestJobsCount, key: 'statJobs' },
  { value: GUIDE_BACKEND_STATS.d1MigrationsCount, key: 'statMigrations' },
  { value: GUIDE_BACKEND_STATS.affiliateNetworksCount, key: 'statNets' },
  { value: GUIDE_BACKEND_STATS.publishingChannelsCount, key: 'statChannels' },
  { value: GUIDE_BACKEND_STATS.supportedNichesCount, key: 'statNiches' },
];

export interface GuideWorkbenchProps {
  readonly locale: 'vi' | 'en';
  readonly initialTarget: GuideActiveTarget;
}

export function GuideWorkbench({ locale, initialTarget }: GuideWorkbenchProps) {
  const t = useTranslations('guide');
  const { target, setTarget, step } = useGuideHashState(initialTarget);
  const mode: GuideMode = target.mode;

  // Crossing into the other mode lands on the canonical peer of what is showing.
  // Clicking the active tab re-anchors to that same peer, so it is never a dead
  // control: the user sees a deliberate, visible change either way.
  const switchMode = useCallback(
    () => {
      const peer = crossPeer(target);
      if (peer !== null) setTarget(peer);
    },
    [setTarget, target],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const canvasLabels = buildCanvasLabels(t);
  const inspectorLabels = buildInspectorLabels(t);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-2">
          {TABS.map((tab) => {
            const isActive = mode === tab.mode;
            return (
              <button
                key={tab.mode}
                id={`guide-tab-${tab.mode}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={PANEL_ID}
                aria-disabled={isActive ? true : undefined}
                onClick={switchMode}
                className={
                  isActive
                    ? 'rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary cursor-default'
                    : 'rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-accent'
                }
              >
                {t(`workbench.${tab.key}`)}
              </button>
            );
          })}
        </div>
        <dl className="flex flex-wrap gap-x-4 font-mono text-[11px] text-muted-foreground">
          {STATS.map((stat) => (
            <div key={stat.key} className="flex gap-1">
              <dt>{t(`workbench.${stat.key}`)}</dt>
              <dd className="font-semibold text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 lg:sticky lg:top-6 lg:self-start">
          <GuideSchematicCanvas
            activeTarget={target}
            locale={locale}
            onSelect={setTarget}
            labels={canvasLabels}
          />
        </div>
        <div className="lg:col-span-5">
          <GuideFocusedInspector
            mode={mode}
            activeTarget={target}
            locale={locale}
            onSelect={setTarget}
            onStep={step}
            labels={inspectorLabels}
            panelId={PANEL_ID}
            labelledById={`guide-tab-${mode}`}
          />
        </div>
      </div>
    </div>
  );
}
