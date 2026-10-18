'use client';

/**
 * WorkflowTimeline — client component that polls /api/raas/workflows/[id] every 3s
 * until workflow reaches a terminal status (completed | failed).
 * Renders 3 WorkflowStepRow cards + final result panel.
 */

import { useEffect, useRef, useState } from 'react';
import { WorkflowStepRow, type StepRowData } from './workflow-step-row';
import { WorkflowStatusBanner } from './workflow-status-banner';
import { WorkflowResultPanel, WorkflowErrorPanel } from './workflow-result-panels';
import {
  TERMINAL_STATUSES,
  POLL_INTERVAL_MS,
} from './workflow-step-status';

interface WorkflowDetail {
  id: string;
  prompt: string;
  status: string;
  final_result: string | null;
  error_message: string | null;
  created_at: string;
  steps: StepRowData[];
}

interface Props {
  workflowId: string;
  initialData: WorkflowDetail;
  locale?: string;
}

export function WorkflowTimeline({ workflowId, initialData, locale = 'en' }: Props) {
  const [data, setData] = useState<WorkflowDetail>(initialData);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Already terminal on mount — no polling needed
    if (TERMINAL_STATUSES.has(initialData.status)) return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/raas/workflows/${workflowId}`);
        if (!res.ok) return;
        const json = await res.json() as WorkflowDetail;
        setData(json);

        if (TERMINAL_STATUSES.has(json.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Silently retry on network error
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workflowId, initialData.status]);

  return (
    <div className="space-y-6">
      {/* Overall status row */}
      <WorkflowStatusBanner status={data.status} locale={locale} />

      {/* Timeline heading */}
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {locale === 'vi' ? 'Tiến trình' : 'Timeline'}
        </h2>
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {data.steps.length > 0 ? (
          data.steps.map((step) => (
            <WorkflowStepRow key={step.step_order} step={step} locale={locale} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No steps loaded yet.</p>
        )}
      </div>

      {/* Final result panel */}
      {data.status === 'completed' && data.final_result && (
        <WorkflowResultPanel finalResult={data.final_result} locale={locale} />
      )}

      {/* Error panel */}
      {data.status === 'failed' && data.error_message && (
        <WorkflowErrorPanel errorMessage={data.error_message} />
      )}
    </div>
  );
}