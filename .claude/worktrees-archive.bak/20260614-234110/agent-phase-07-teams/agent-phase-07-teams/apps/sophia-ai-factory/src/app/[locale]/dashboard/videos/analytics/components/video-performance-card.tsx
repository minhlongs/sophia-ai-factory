'use client';

import { useTranslations } from 'next-intl';

interface VideoPerformanceCardProps {
  videoId: string;
  title: string;
  views: number;
  watchTimeSec: number;
  ctr: number;
  engagement: number;
}

export function VideoPerformanceCard({
  title,
  views,
  watchTimeSec,
  ctr,
  engagement,
}: VideoPerformanceCardProps) {
  const t = useTranslations('analytics');

  const watchHours = Math.round(watchTimeSec / 3600 * 10) / 10;

  return (
    <div className="p-3 border rounded-md space-y-2">
      <p className="text-sm font-medium truncate">{title}</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">{t('views')}</p>
          <p className="text-sm font-semibold">{views.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('watchTime')}</p>
          <p className="text-sm font-semibold">{watchHours}h</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('ctr')}</p>
          <p className="text-sm font-semibold">{(ctr * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('engagement')}</p>
          <p className="text-sm font-semibold">{(engagement * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}
