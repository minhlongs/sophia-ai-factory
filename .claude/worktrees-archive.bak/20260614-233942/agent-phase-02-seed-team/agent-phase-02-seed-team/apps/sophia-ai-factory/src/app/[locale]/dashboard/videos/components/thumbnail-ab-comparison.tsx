'use client';

import { useTranslations } from 'next-intl';

interface ThumbnailVariant {
  id: string;
  variant_index: number;
  strategy: string;
  impressions: number;
  clicks: number;
  is_selected: number;
}

interface ThumbnailAbComparisonProps {
  variants: ThumbnailVariant[];
}

export function ThumbnailAbComparison({ variants }: ThumbnailAbComparisonProps) {
  const t = useTranslations('thumbnails');

  if (variants.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t('abTest')}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {variants.map((v) => {
          const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0;
          return (
            <div
              key={v.id}
              className={`p-2 border rounded-md text-center ${
                v.is_selected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-input'
              }`}
            >
              <p className="text-xs font-medium capitalize">{v.strategy}</p>
              <p className="text-lg font-semibold">{ctr.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {v.clicks}/{v.impressions} {t('clicks')}
              </p>
              {v.is_selected === 1 && (
                <span className="text-xs text-green-600 font-medium">{t('winner')}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
