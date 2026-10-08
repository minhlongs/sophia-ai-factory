import * as React from 'react';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { RoiStatusBadge } from '@/components/growth/roi-status-badge';
import { AttributionChart } from '@/components/growth/attribution-chart';

// Mock data fetcher logic (to be replaced with actual land/tree layer call)
async function getRoiData(campaignId: string) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    id: campaignId,
    name: 'Q3 Viral Shorts Campaign',
    status: 'winner' as const,
    totalRoi: 3450.50,
    cvr: 4.2, // Conversion rate
    timeline: [
      { date: '2026-10-01', revenue: 450.25, label: 'Day 1 Surge' },
      { date: '2026-10-02', revenue: 850.00, label: 'Algorithm Pick-up' },
      { date: '2026-10-03', revenue: 1200.75, label: 'Peak Traffic' },
      { date: '2026-10-04', revenue: 949.50, label: 'Steady Decay' },
    ]
  };
}

async function RoiDashboardClient({ campaignId }: { campaignId: string }) {
  const data = await getRoiData(campaignId);
  const t = await getTranslations('Growth');

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t.has('campaign_id') ? t('campaign_id') : 'Campaign ID'}: {data.id}
          </p>
        </div>
        <RoiStatusBadge status={data.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {t.has('total_revenue') ? t('total_revenue') : 'Total Revenue'}
          </p>
          <p className="text-2xl font-bold text-indigo-700">${data.totalRoi.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {t.has('conversion_rate') ? t('conversion_rate') : 'Conversion Rate'}
          </p>
          <p className="text-2xl font-bold text-amber-700">{data.cvr.toFixed(1)}%</p>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-4">
          {t.has('revenue_timeline') ? t('revenue_timeline') : 'Revenue Attribution Timeline'}
        </h3>
        <AttributionChart data={data.timeline} />
      </div>
    </div>
  );
}

export default async function CampaignRoiPage({ params }: { params: { id: string } }) {
  const t = await getTranslations('Growth');

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t.has('roi_dashboard') ? t('roi_dashboard') : 'ROI Dashboard'}
      </h1>

      <Suspense fallback={
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      }>
        <RoiDashboardClient campaignId={params.id} />
      </Suspense>
    </div>
  );
}
