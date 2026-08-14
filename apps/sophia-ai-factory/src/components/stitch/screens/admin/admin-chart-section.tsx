'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CHART_GRADIENT_ID, CHART_LABELS } from './admin-page-types';

export function AdminChartSection() {
  const t = useTranslations('stitch.admin');

  return (
    <section aria-label={t('aria.userGrowth')} className="bg-surface-container border border-outline-variant rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-on-surface">{t('charts.userGrowth')}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{t('charts.userGrowthSub')}</p>
        </div>
        <span className="text-xs font-bold text-primary">+24.8%</span>
      </div>

      <div className="relative h-48 w-full">
        <svg
          className="w-full h-full"
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={CHART_GRADIENT_ID} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,180 Q80,160 160,170 T320,130 T480,100 T640,60 T800,20 L800,200 L0,200 Z"
            fill={`url(#${CHART_GRADIENT_ID})`}
          />
          <path
            d="M0,180 Q80,160 160,170 T320,130 T480,100 T640,60 T800,20"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
          />
        </svg>
      </div>

      <div className="w-full flex justify-between mt-4 px-2">
        {CHART_LABELS.map((label) => (
          <span key={label} className="text-[10px] text-on-surface-variant font-bold">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
