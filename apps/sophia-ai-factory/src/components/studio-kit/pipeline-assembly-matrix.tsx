'use client';

/**
 * 5-Stage Cinematic Assembly Line Matrix (MD3 Expressive).
 *
 * Displays all 39 live engines in a single-viewport 5-column conveyor so CEOs
 * can watch (and screen-record) each stage lighting up sequentially with real
 * server telemetry from POST /api/studio/pipeline/execute.
 *
 * @module components/studio-kit/pipeline-assembly-matrix
 */

import type { StudioCapabilitySpec } from '@/seed/ui/studio-capability-registry';
import type { EngineLiveTelemetry } from '@/seed/ui/live-pipeline-runner';
import type { PipelineStageGroup } from '@/seed/ui/pipeline-stage-manifest';

export interface PipelineAssemblyMatrixProps {
  readonly locale: 'vi' | 'en';
  readonly stages: readonly PipelineStageGroup[];
  readonly matchedIds: ReadonlySet<string>;
  readonly selectedId: string | null;
  readonly activeEngineId: string | null;
  readonly liveTelemetry: Readonly<Record<string, EngineLiveTelemetry>>;
  readonly onSelectEngine: (capability: StudioCapabilitySpec) => void;
}

function getStatusDotClass(
  isRunning: boolean,
  telemetry: EngineLiveTelemetry | undefined,
): string {
  if (isRunning) return 'bg-primary animate-pulse';
  if (!telemetry) return 'bg-muted-foreground/35';
  if (telemetry.state === 'passed') return 'bg-emerald-500';
  if (telemetry.state === 'warning') return 'bg-amber-500';
  return 'bg-destructive';
}

export function PipelineAssemblyMatrix({
  locale,
  stages,
  matchedIds,
  selectedId,
  activeEngineId,
  liveTelemetry,
  onSelectEngine,
}: PipelineAssemblyMatrixProps) {
  return (
    <div
      data-testid="pipeline-assembly-matrix"
      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5"
    >
      {stages.map((stage) => {
        const doneInStage = stage.capabilities.filter((cap) => Boolean(liveTelemetry[cap.id])).length;
        const isStageActive = stage.capabilities.some((cap) => cap.id === activeEngineId);
        const isStageComplete = stage.capabilities.length > 0 && doneInStage === stage.capabilities.length;

        return (
          <section
            key={stage.id}
            data-testid={`pipeline-stage-${stage.id}`}
            className={`md3-surface-tonal flex flex-col gap-2 rounded-2xl border p-3 transition-colors ${
              isStageActive
                ? 'border-primary ring-1 ring-primary/30'
                : isStageComplete
                  ? 'border-emerald-500/40'
                  : 'border-border'
            }`}
          >
            <header className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
              <div className="min-w-0">
                <h3 className="truncate text-xs font-bold text-foreground">
                  {stage.title[locale]}
                </h3>
                <p className="truncate text-[11px] text-muted-foreground">
                  {stage.subtitle[locale]}
                </p>
              </div>
              <span
                className={`font-code md3-tabular-nums shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isStageComplete
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : isStageActive
                      ? 'bg-[var(--md-sys-color-primary-container)] text-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {doneInStage}/{stage.capabilities.length}
              </span>
            </header>

            <div className="flex flex-col gap-1.5">
              {stage.capabilities.map((cap) => {
                const telemetry = liveTelemetry[cap.id];
                const isRunning = activeEngineId === cap.id;
                const isSelected = selectedId === cap.id;
                const isMatched = matchedIds.has(cap.id);

                return (
                  <button
                    key={cap.id}
                    type="button"
                    data-testid={`engine-pill-${cap.id}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectEngine(cap)}
                    className={`flex min-h-[44px] w-full flex-col justify-center rounded-xl border px-2.5 py-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isRunning
                        ? 'border-primary bg-[var(--md-sys-color-primary-container)] ring-2 ring-primary/40'
                        : isSelected
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/70 bg-card/80 hover:border-primary/40 hover:bg-card'
                    } ${isMatched ? 'opacity-100' : 'opacity-35'}`}
                  >
                    <div className="flex w-full items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${getStatusDotClass(isRunning, telemetry)}`}
                      />
                      <span className="truncate text-xs font-semibold text-foreground">
                        {cap.title[locale]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex w-full items-center justify-between gap-1 pl-3.5">
                      <span className="font-code md3-tabular-nums truncate text-[11px] text-muted-foreground">
                        {telemetry ? telemetry.metricOutput : cap.kpiValue}
                      </span>
                      {telemetry ? (
                        <span className="font-code md3-tabular-nums shrink-0 text-[10px] text-muted-foreground">
                          {telemetry.durationMs}ms
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
