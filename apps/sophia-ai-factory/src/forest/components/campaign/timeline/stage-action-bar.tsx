// i18n-namespace: campaign
'use client';

interface StageActionBarProps {
  currentStep: string;
  status: 'processing' | 'completed' | 'failed';
  onRetry?: () => void;
  onCancel?: () => void;
}

export function StageActionBar({
  currentStep,
  status,
  onRetry,
  onCancel,
}: StageActionBarProps) {
  const statusColor =
    status === 'completed'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : status === 'failed'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {status}
        </span>
        <span className="text-xs text-muted-foreground">
          Step: {currentStep}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'failed' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        )}
        {status === 'processing' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2.5 py-1 text-xs font-medium border border-border text-foreground hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
