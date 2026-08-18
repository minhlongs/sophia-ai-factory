'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { toast } from 'sonner';

interface ScheduleJob {
  id: string;
  videoId: string;
  target: string;
  provider: string;
  status: string;
  caption: string | null;
  scheduledAt: number;
  createdAt: number;
  retryCount: number;
}

export function ScheduleManagementClient({
  workspaceId,
  initialJobs,
}: {
  workspaceId: string;
  initialJobs: ScheduleJob[];
}) {
  const t = useTranslations('dashboard.publish');
  const [jobs, setJobs] = useState<ScheduleJob[]>(initialJobs);
  const [isPending, startTransition] = useTransition();

  async function cancelJob(jobId: string) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/publish/queue', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, workspaceId }),
        });
        if (!res.ok) throw new Error('cancel failed');
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        toast.success(t('cancelled'));
      } catch {
        toast.error(t('cancel_failed'));
      }
    });
  }

  function formatDate(unixSec: number) {
    return new Date(unixSec * 1000).toLocaleString();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('scheduled_publishes')}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('no_scheduled') ?? 'No scheduled publications'}
            </p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{job.provider}</Badge>
                      <span className="font-medium">{job.target}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(job.scheduledAt)}
                      {job.retryCount > 0 && ` · ${t('retries', { count: job.retryCount })}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => cancelJob(job.id)}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}