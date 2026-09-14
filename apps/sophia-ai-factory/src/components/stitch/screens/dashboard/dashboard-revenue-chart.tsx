'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/stitch';
import { useTranslations } from 'next-intl';

export function DashboardRevenueChart() {
  const t = useTranslations('stitch.dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  const chartData = [40, 60, 45, 85, 70, 95, 65];

  const periodOptions = [
    { key: '30d', label: t('revenueChart.periods.30d') },
    { key: '6m', label: t('revenueChart.periods.6m') },
    { key: 'ytd', label: t('revenueChart.periods.ytd') },
  ];

  return (
    <Card className="lg:col-span-2" padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">
              {t('revenueChart.title')}
            </h4>
            <p className="font-label-md text-label-md text-on-surface-variant">
              {t('revenueChart.subtitle')}
            </p>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-surface-container-low border-none rounded-xl text-label-sm font-label-sm focus:ring-primary-container pr-8 cursor-pointer"
          >
            {periodOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-between gap-base pt-md">
          {chartData.map((height, idx) => (
            <div
              key={idx}
              className="w-full bg-primary/10 rounded-t-lg relative group flex-1"
              style={{ height: '100%' }}
            >
              <div
                className="absolute inset-0 bg-primary rounded-t-lg transition-all duration-500 group-hover:bg-primary-container"
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-md px-base text-on-surface-variant font-label-sm">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </CardContent>
    </Card>
  );
}
