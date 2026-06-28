'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { getBatchStatusAction, cancelBatchAction } from '@/app/actions/batch-generate-action';
import type { BatchJob, BatchVideo } from '@/seed/db/repositories/batch-jobs-repo';
import { Loader2, XCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface BatchProgressDashboardProps {
  batchId: string;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  done: CheckCircle,
  failed: XCircle,
  queued: Clock,
  generating: Loader2,
  composing: Loader2,
  cancelled: AlertTriangle,
};

export function BatchProgressDashboard({ batchId }: BatchProgressDashboardProps) {
  const t = useTranslations('batch');
  const [batch, setBatch] = useState<BatchJob | null>(null);
  const [videos, setVideos] = useState<BatchVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await getBatchStatusAction(batchId);
    if (result.success) {
      setBatch(result.data.batch);
      setVideos(result.data.videos);
    }
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    refresh();
    const isActive = (s: string) => ['pending', 'processing'].includes(s);
    const interval = setInterval(() => {
      if (batch && isActive(batch.status)) refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh, batch?.status]);

  async function handleCancel() {
    await cancelBatchAction(batchId);
    await refresh();
  }

  if (loading || !batch) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = batch.total_videos > 0
    ? Math.round(((batch.completed_videos + batch.failed_videos) / batch.total_videos) * 100)
    : 0;

  const isActive = ['pending', 'processing'].includes(batch.status);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{batch.name}</CardTitle>
            {isActive && (
              <Button variant="destructive" size="sm" onClick={handleCancel}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}%</span>
              <span>
                {batch.completed_videos}/{batch.total_videos} {t('completed')}
                {batch.failed_videos > 0 && ` · ${batch.failed_videos} ${t('failed')}`}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{t('status')}: {batch.status}</span>
            <span>{t('cost')}: ${(batch.actual_cost_cents / 100).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Video list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('videoList')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {videos.map((v) => {
              const Icon = STATUS_ICONS[v.status] ?? Clock;
              const isSpinning = v.status === 'generating' || v.status === 'composing';
              return (
                <div key={v.id} className="flex items-center gap-3 py-2 text-xs">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSpinning ? 'animate-spin' : ''} ${v.status === 'done' ? 'text-green-500' : v.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span className="font-mono text-muted-foreground w-8">#{v.row_index + 1}</span>
                  <span className="truncate flex-1">
                    {(() => {
                      try { return (JSON.parse(v.input_data) as { prompt?: string }).prompt?.slice(0, 60) ?? '—'; }
                      catch { return '—'; }
                    })()}
                  </span>
                  <span className="text-muted-foreground capitalize">{v.status}</span>
                  {v.output_video_url && (
                    <a href={v.output_video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {t('view')}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
