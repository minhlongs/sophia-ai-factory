'use client';

import { Progress } from '@/seed/components/ui/progress';

export interface QuotaGaugeRowProps {
  label: string;
  current: number;
  limit: number;
  suffix?: string;
}

export function QuotaGaugeRow({
  label,
  current,
  limit,
  suffix = 'credits',
}: QuotaGaugeRowProps) {
  const percentage = limit === 0 ? 0 : Math.min((current / limit) * 100, 100);
  const color =
    percentage >= 100
      ? 'bg-red-500'
      : percentage >= 80
      ? 'bg-yellow-500'
      : 'bg-green-500';
  const icon = percentage >= 100 ? '🔴' : percentage >= 80 ? '🟡' : '🟢';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">
          {icon} {label}
        </span>
        <span className="text-sm text-muted-foreground">
          {current.toLocaleString()} / {limit.toLocaleString()} {suffix}
        </span>
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${color}`}
        indicatorClassName={color}
      />
      {percentage >= 80 && (
        <p className="text-xs text-orange-600">
          {percentage >= 100
            ? 'Limit exceeded!'
            : `${Math.round(100 - percentage)}% remaining before limit`}
        </p>
      )}
    </div>
  );
}
