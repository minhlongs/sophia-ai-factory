'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublishJob } from './modules';

export function usePublishQueue(locale: string) {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/${locale}/api/publish/queue`);
      if (!response.ok) {
        throw new Error('Failed to fetch publish queue');
      }
      const data = (await response.json()) as { jobs: PublishJob[]; showApprovalBanner: boolean };
      setJobs(data.jobs || []);
      setShowApprovalBanner(data.showApprovalBanner || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const handleApprove = async (jobId: string) => {
    setApprovingJobId(jobId);
    try {
      const response = await fetch(`/${locale}/api/publish/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Approval failed');
      }

      await fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApprovingJobId(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const response = await fetch(`/${locale}/api/publish/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Retry failed');
      }

      await fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Retry failed');
    }
  };

  return {
    jobs,
    isLoading,
    error,
    showApprovalBanner,
    approvingJobId,
    fetchJobs,
    handleApprove,
    handleRetry,
  };
}
