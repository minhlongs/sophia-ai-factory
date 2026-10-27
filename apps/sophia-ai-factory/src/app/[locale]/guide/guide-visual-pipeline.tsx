/**
 * guide-visual-pipeline.tsx
 * Part A of the Guide: Visual 5-Stage Factory Execution Flow with concrete Input -> Engine -> Output.
 */

import { GUIDE_PIPELINE_STAGES } from '@/seed/guide';

// i18n-namespace: guide

export function GuideVisualPipeline({
  t,
  locale,
}: {
  t: (key: string) => string;
  locale: 'vi' | 'en';
}) {
  return (
    <section className="mb-14">
      <div className="mb-6">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-2">
          {t('architectureBadge')}
        </span>
        <h2 className="text-2xl font-bold text-foreground">
          {t('visualPipeline.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('visualPipeline.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {GUIDE_PIPELINE_STAGES.map((stage, idx) => (
          <div
            key={stage.step}
            className="bg-card border border-border rounded-xl p-5 sm:p-6 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  0{stage.step}
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {stage.name[locale]}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {stage.subtitle[locale]}
                  </p>
                </div>
              </div>
              {idx < GUIDE_PIPELINE_STAGES.length - 1 && (
                <span className="text-xs font-mono text-primary/80 hidden sm:inline">
                  STAGE 0{stage.step} ──► STAGE 0{stage.step + 1}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/20 border border-border/60 rounded-lg p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1">
                  1. {t('visualPipeline.inputLabel')}
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {stage.input[locale]}
                </p>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                  2. {t('visualPipeline.engineLabel')}
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {stage.engine[locale]}
                </p>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  3. {t('visualPipeline.outputLabel')}
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {stage.output[locale]}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-background/60 border border-border/50 rounded-lg p-3 font-mono text-xs">
              <div className="truncate">
                <span className="text-muted-foreground mr-2">
                  [{t('visualPipeline.sampleCommandLabel')}]:
                </span>
                <span className="text-amber-300">{stage.sampleCommand}</span>
              </div>
              <div className="truncate">
                <span className="text-muted-foreground mr-2">
                  [{t('visualPipeline.sampleResultLabel')}]:
                </span>
                <span className="text-emerald-300">{stage.sampleResult}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
