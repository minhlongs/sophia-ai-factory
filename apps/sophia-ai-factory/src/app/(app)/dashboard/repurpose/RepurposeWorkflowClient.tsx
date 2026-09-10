'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, useOptimistic } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { Input } from '@/seed/components/ui/input';
import { toast } from 'sonner';

interface RepurposeJob {
  id: string;
  sourceVideoId: string;
  userId: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

const STATUS_COPY: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export function RepurposeWorkflowClient({ jobs: initialJobs }: { jobs: RepurposeJob[]; userId: string }) {
  const t = useTranslations('dashboard.repurpose');
  const [sourceVideoId, setSourceVideoId] = useState('');
  const [jobs, setJobs] = useOptimistic(initialJobs);
  const [isPending, startTransition] = useTransition();

  async function createJob() {
    if (!sourceVideoId.trim()) {
      toast.error(t('enter_video_id'));
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/repurpose/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceVideoId: sourceVideoId.trim() }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) throw new Error((data.error as string) || 'failed');
        setSourceVideoId('');
        toast.success(t('job_created', { id: String(data.jobId) }));
        // Refresh jobs list
        const listRes = await fetch('/api/repurpose/jobs');
        if (listRes.ok) {
          const listData = (await listRes.json()) as { jobs?: RepurposeJob[] };
          setJobs(listData.jobs ?? []);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('create_failed'));
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('create_repurpose')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={sourceVideoId}
              onChange={(e) => setSourceVideoId(e.target.value)}
              placeholder={t('video_id_placeholder') ?? 'Video ID or URL'}
              disabled={isPending}
            />
            <Button onClick={createJob} disabled={isPending}>
              {t('create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('recent_jobs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('no_jobs') ?? 'No repurpose jobs yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const statusInfo = STATUS_COPY[job.status] ?? { label: job.status, variant: 'secondary' as const };
                return (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        <span className="font-mono text-xs">{job.sourceVideoId}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt * 1000).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{job.id.slice(0, 8)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}