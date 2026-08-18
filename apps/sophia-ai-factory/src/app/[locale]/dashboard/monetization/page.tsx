/**
 * Monetization Dashboard — server component
 * Fetches /api/monetization data and renders summary cards, channel table, and attribution.
 */

export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { SummaryCards } from './summary-cards';
import { ChannelTable } from './channel-table';

export interface MonetizationData {
  aggregate: {
    totalRevenueCents: number;
    totalCostCents: number;
    roi: number;
    unitCount: number;
    avgRevenuePerUnit: number;
    avgCostPerUnit: number;
  };
  topChannels: Array<{
    channel: string | null;
    totalRevenueCents: number;
    totalCostCents: number;
    roi: number;
    unitCount: number;
  }>;
  revenueAttribution: Array<{
    channel: string;
    network: string;
    revenueCents: number;
    costCents: number;
    roi: number;
    clicks: number;
    conversions: number;
  }>;
  dynamicPricing: {
    tier: string;
    baseCostMCU: number;
    adjustedCostMCU: number;
    multiplier: number;
  };
}

export default async function MonetizationPage() {
  const t = await getTranslations('monetization');

  let data: MonetizationData | null = null;
  let error: string | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/monetization?workspaceId=default`, {
      cache: 'no-store',
    });
    if (res.ok) {
      data = (await res.json()) as MonetizationData;
    } else {
      error = `API ${res.status}`;
    }
  } catch {
    error = 'Failed to fetch monetization data';
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('pageDescription')}</p>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : !data ? (
        <p className="text-sm text-[hsl(240,12%,45%)]">{t('loading')}</p>
      ) : (
        <>
          <SummaryCards aggregate={data.aggregate} dynamicPricing={data.dynamicPricing} t={(k) => t(k)} />
          <ChannelTable
            topChannels={data.topChannels}
            revenueAttribution={data.revenueAttribution}
            t={(k) => t(k)}
          />
        </>
      )}
    </div>
  );
}
