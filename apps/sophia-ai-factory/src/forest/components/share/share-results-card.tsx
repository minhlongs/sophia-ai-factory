'use client';

import { ShareButtons } from './share-buttons';

interface ShareResultsCardProps {
  sopName: string;
  stepsCompleted: number;
  totalSteps: number;
  executionTime?: string;
  affiliateUrl?: string;
  locale?: string;
}

/** Completion percentage clamped to [0, 100] */
function completionPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

export function ShareResultsCard({
  sopName,
  stepsCompleted,
  totalSteps,
  executionTime,
  affiliateUrl,
  locale = 'en',
}: ShareResultsCardProps) {
  const percent = completionPercent(stepsCompleted, totalSteps);
  const isComplete = stepsCompleted >= totalSteps;

  const badgeClass = isComplete
    ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
    : 'bg-amber-900/50 text-amber-300 border border-amber-700/50';

  const badgeLabel = isComplete
    ? (locale === 'vi' ? 'Hoàn thành' : 'Completed')
    : (locale === 'vi' ? 'Đang tiến hành' : 'In Progress');

  const shareTitle = `${sopName} — ${percent}% ${badgeLabel}`;
  const shareText =
    locale === 'vi'
      ? `Tôi vừa hoàn thành ${stepsCompleted}/${totalSteps} bước của SOP "${sopName}" bằng Sophia AI!`
      : `I just completed ${stepsCompleted}/${totalSteps} steps of the "${sopName}" SOP with Sophia AI!`;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-card border border-border p-px">
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-accent/10 pointer-events-none" />

      <div className="relative rounded-2xl bg-background p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest mb-1">SOP Results</p>
            <h3 className="text-foreground font-semibold text-base leading-snug truncate">{sopName}</h3>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>

        {/* Progress row */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {stepsCompleted} / {totalSteps} {locale === 'vi' ? 'bước' : 'steps'}
            </span>
            <span className="text-foreground font-semibold">{percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Execution time */}
        {executionTime && (
          <p className="text-xs text-muted-foreground/50">
            {locale === 'vi' ? 'Thời gian chạy:' : 'Execution time:'}{' '}
            <span className="text-muted-foreground">{executionTime}</span>
          </p>
        )}

        {/* Share buttons (only if affiliateUrl is provided) */}
        {affiliateUrl && (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground/50 mb-2">
              {locale === 'vi' ? 'Chia sẻ kết quả:' : 'Share results:'}
            </p>
            <ShareButtons url={affiliateUrl} title={shareTitle} text={shareText} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
          <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-primary to-purple-600 shrink-0" />
          <span className="text-xs text-muted-foreground/50">
            Powered by <span className="text-muted-foreground font-medium">Sophia AI</span>
          </span>
        </div>
      </div>
    </div>
  );
}
