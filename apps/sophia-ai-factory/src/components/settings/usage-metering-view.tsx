'use client';

import React, { useState } from 'react';
import { Video, Mic, Image as ImageIcon, Cpu } from 'lucide-react';
import type { CustomerUsageReport } from '@/land/billing/customer-usage-types';
import { UsagePlanSummaryCards } from './usage-plan-summary-cards';
import { UsageProviderTable } from './usage-provider-table';
import {
  MetricCard,
  UsageDailyChart,
  type UsageMetricKind,
} from './usage-daily-chart';

export {
  MetricCard,
  UsageDailyChart,
  type UsageMetricKind,
  type MetricCardProps,
  type UsageDailyChartProps,
} from './usage-daily-chart';

export interface UsageMeteringViewProps {
  report: CustomerUsageReport;
}

export function UsageMeteringView({ report }: UsageMeteringViewProps) {
  const [activeMetric, setActiveMetric] = useState<UsageMetricKind>('credits');

  return (
    <div className="space-y-8">
      {/* 1. Plan, Quota, Overage & Next Billing Event Cards */}
      <UsagePlanSummaryCards report={report} />

      {/* 2. Overview Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Video Generated • Render"
          value={`${report.totals.videoMinutes} mins`}
          subtitle="Render Engine (HeyGen/Direct)"
          icon={Video}
          active={activeMetric === 'video'}
          onClick={() => setActiveMetric('video')}
        />
        <MetricCard
          title="Voiceover • Giọng đọc AI"
          value={`${report.totals.elevenLabsChars.toLocaleString()} chars`}
          subtitle="ElevenLabs AI Voice"
          icon={Mic}
          active={activeMetric === 'voice'}
          onClick={() => setActiveMetric('voice')}
        />
        <MetricCard
          title="Images & Visuals • Hình ảnh"
          value={`${report.totals.falAiImages} calls`}
          subtitle="fal.ai Diffusion"
          icon={ImageIcon}
          active={activeMetric === 'images'}
          onClick={() => setActiveMetric('images')}
        />
        <MetricCard
          title="LLM Intelligence • Trí tuệ LLM"
          value={`${report.totals.openRouterTokens.toLocaleString()} tokens`}
          subtitle="OpenRouter / Claude / GPT"
          icon={Cpu}
          active={activeMetric === 'tokens'}
          onClick={() => setActiveMetric('tokens')}
        />
      </div>

      {/* 3. Daily Usage Breakdown Chart */}
      <UsageDailyChart
        dailyUsage={report.dailyUsage}
        billingPeriod={report.billingPeriod}
        activeMetric={activeMetric}
        onSelectCredits={() => setActiveMetric('credits')}
      />

      {/* 4. Provider Accounting & Transparency Table */}
      <UsageProviderTable providers={report.providers} />
    </div>
  );
}
