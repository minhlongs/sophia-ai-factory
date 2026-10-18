'use client';

/**
 * Result and error panels for WorkflowTimeline.
 * Layer: forest/components/workflows
 * @module forest/components/workflows/workflow-result-panels
 */

interface ResultPanelProps {
  finalResult: string;
  locale: string;
}

export function WorkflowResultPanel({ finalResult, locale }: ResultPanelProps) {
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
      <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
        {locale === 'vi' ? 'Kết quả cuối' : 'Final Result'}
      </p>
      <p className="text-sm text-foreground whitespace-pre-wrap font-mono">
        {finalResult}
      </p>
    </div>
  );
}

interface ErrorPanelProps {
  errorMessage: string;
}

export function WorkflowErrorPanel({ errorMessage }: ErrorPanelProps) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
        Error
      </p>
      <p className="text-sm text-foreground font-mono">{errorMessage}</p>
    </div>
  );
}