'use client';

/**
 * Harness Health Card View Component
 * Layer: app/[locale]/dashboard/system-health/components/harness-health
 */

import React, { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  AlertCircle,
  Clock,
  Play,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { HarnessStatusResponse } from './types';
import { TestIcon, TEST_DISPLAY_NAME } from './test-helpers';
import { JobStatusBadge } from './job-status-badge';

export function HarnessHealthCard() {
  const { data, isLoading, isError } = useQuery<HarnessStatusResponse>({
    queryKey: ['harness-status'],
    queryFn: async () => {
      const res = await fetch('/api/v1/harness/status');
      if (!res.ok) throw new Error('Failed to fetch harness status');
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const triggerJob = useCallback(async () => {
    try {
      await fetch('/api/v1/harness/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ triggered_by: 'web' }),
      });
    } catch {
      // Silently fail — status will update via polling
    }
  }, []);

  const daemonOnline = data?.daemon?.status === 'ONLINE';

  return (
    <section aria-label="Harness Engineering Health">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">Harness Engineering</h2>

        {/* Daemon status indicator */}
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              daemonOnline
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
              {daemonOnline ? (
                <Wifi className="w-3 h-3" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3 h-3" aria-hidden="true" />
              )}
              Daemon {data.daemon.status}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={triggerJob}
            className="gap-1.5"
          >
            <Play className="w-3 h-3" aria-hidden="true" />
            Run Check
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-24">
            <div className="motion-safe:animate-spin rounded-full h-6 w-6 border-b-2 border-primary" role="status" aria-label="Loading harness status" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <span>Không thể tải dữ liệu harness. Thử lại sau 15s.</span>
          </div>
        )}

        {data && !data.latestJob && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Chưa có harness job nào. Bấm &quot;Run Check&quot; để bắt đầu kiểm tra hệ thống.
          </p>
        )}

        {data?.latestJob && (
          <div className="space-y-4">
            {/* Job header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <JobStatusBadge status={data.latestJob.status} />
                <span className="text-xs text-muted-foreground font-mono">
                  {data.latestJob.id.substring(0, 8)}…
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {new Date(data.latestJob.created_at).toLocaleString()}
                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                  {data.latestJob.triggered_by}
                </span>
              </div>
            </div>

            {/* Results grid */}
            {data.latestJob.results.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.latestJob.results.map((result) => (
                  <div
                    key={result.test_name}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      result.status === 'success'
                        ? 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10'
                        : 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'
                    }`}
                  >
                    <div className={`mt-0.5 ${
                      result.status === 'success'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
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
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate" title={result.error_message}>
                          {result.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daemon last poll */}
            {data.daemon.last_poll && (
              <p className="text-xs text-muted-foreground text-right">
                Daemon poll cuối: {new Date(data.daemon.last_poll).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
