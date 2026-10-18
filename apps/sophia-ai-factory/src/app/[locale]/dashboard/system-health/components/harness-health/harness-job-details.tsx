'use client';

/**
 * Harness Job Details Sub-Component
 * Layer: app/[locale]/dashboard/system-health/components/harness-health
 */

import React from 'react';
import { Clock } from 'lucide-react';
import type { HarnessJob } from './types';
import { TestIcon, TEST_DISPLAY_NAME } from './test-helpers';
import { JobStatusBadge } from './job-status-badge';

export interface HarnessJobDetailsProps {
  job: HarnessJob;
  lastPoll: string | null;
}

export function HarnessJobDetails({ job, lastPoll }: HarnessJobDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Job header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <JobStatusBadge status={job.status} />
          <span className="text-xs text-muted-foreground font-mono">
            {job.id.substring(0, 8)}…
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" aria-hidden="true" />
          {new Date(job.created_at).toLocaleString()}
          <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
            {job.triggered_by}
          </span>
        </div>
      </div>

      {/* Results grid */}
      {job.results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {job.results.map((result) => (
            <div
              key={result.test_name}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                result.status === 'success'
                  ? 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10'
                  : 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'
              }`}
            >
              <div
                className={`mt-0.5 ${
                  result.status === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                <TestIcon name={result.test_name} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {TEST_DISPLAY_NAME[result.test_name] || result.test_name}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {result.duration_ms}ms
                  </span>
                </div>
                {result.error_message && (
                  <p
                    className="text-xs text-red-600 dark:text-red-400 mt-1 truncate"
                    title={result.error_message}
                  >
                    {result.error_message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daemon last poll */}
      {lastPoll && (
        <p className="text-xs text-muted-foreground text-right">
          Daemon poll cuối: {new Date(lastPoll).toLocaleString()}
        </p>
      )}
    </div>
  );
}
