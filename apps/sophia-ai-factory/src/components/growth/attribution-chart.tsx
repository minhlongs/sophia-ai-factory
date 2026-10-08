import * as React from 'react';
import { useTranslations } from 'next-intl';

interface TimelineEvent {
  date: string;
  revenue: number;
  label: string;
}

interface AttributionChartProps {
  data: TimelineEvent[];
  className?: string;
}

export function AttributionChart({ data, className = '' }: AttributionChartProps) {
  const t = useTranslations('Growth');

  if (!data || data.length === 0) {
    const emptyText = t.has('chart_empty') ? t('chart_empty') : 'No data available';
    return <div className={`text-sm text-gray-500 py-4 ${className}`}>{emptyText}</div>;
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className={`space-y-4 ${className}`}>
      {data.map((item, index) => {
        const percentage = Math.min((item.revenue / maxRevenue) * 100, 100);
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{item.date} - {item.label}</span>
              <span className="font-semibold text-gray-900">${item.revenue.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden flex">
              <div
                className="bg-amber-600 h-2.5 rounded-full"
                style={{ width: `${percentage}%` }}
                role="progressbar"
                aria-valuenow={item.revenue}
                aria-valuemin={0}
                aria-valuemax={maxRevenue}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
