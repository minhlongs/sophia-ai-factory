'use client';

/**
 * Overall status banner for WorkflowTimeline.
 * Layer: forest/components/workflows
 * @module forest/components/workflows/workflow-status-banner
 */

import { classForStatus } from './workflow-step-status';

interface Props {
  status: string;
  locale: string;
}

export function WorkflowStatusBanner({ status, locale }: Props) {
  const isRunning = status === 'running';
  const isTerminal = ['completed', 'failed'].includes(status);

  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-sm font-medium px-3 py-1 rounded-full ${classForStatus(status)}`}
      >
        {locale === 'vi'
          ? status === 'completed'
            ? 'Hoàn thành'
            : status === 'failed'
              ? 'Thất bại'
              : status === 'running'
                ? 'Đang chạy'
                : 'Chờ xử lý'
          : status === 'completed'
            ? 'Completed'
            : status === 'failed'
              ? 'Failed'
              : status === 'running'
                ? 'Running'
                : 'Queued'}
      </span>
      {isRunning && (
        <span className="material-symbols-outlined text-base text-primary motion-safe:animate-spin">
          progress_activity
        </span>
      )}
      {isTerminal && (
        <span
          className={`material-symbols-outlined text-base ${
            status === 'completed' ? 'text-green-600' : 'text-red-700'
          }`}
        >
          {status === 'completed' ? 'check_circle' : 'cancel'}
        </span>
      )}
    </div>
  );
}