/**
 * Static default snapshots and UCB1 Hook Ranking Table for Affiliates Dashboard.
 * @module app/[locale]/dashboard/affiliates/affiliates-dashboard-sections
 */

import React from 'react';
import type { ScalingDecision } from '@/tree/affiliate/scaling/auto-campaign-scaler';

export interface AffiliateMetrics {
  totalVideosGenerated: number;
  totalBridgeClicks: number;
  totalCommissionUsd: number;
  activeNiches: string[];
}

export const DEFAULT_AFFILIATE_METRICS: AffiliateMetrics = {
  totalVideosGenerated: 142,
  totalBridgeClicks: 3840,
  totalCommissionUsd: 1248.5,
  activeNiches: ['saas_global', 'crypto_global'],
};

export const DEFAULT_SCALING_DECISIONS: ScalingDecision[] = [
  {
    campaignId: 'camp-01',
    hookName: 'Secret AI Tool Nobody Knows',
    ctrPercent: 5.4,
    cvrPercent: 3.2,
    epcCents: 482,
    recommendedDailyVideos: 4,
    action: 'SCALE_AGGRESSIVE',
    reason: 'High EPC and conversion rate',
  },
  {
    campaignId: 'camp-02',
    hookName: 'Solana Meme Breakout Alert',
    ctrPercent: 4.8,
    cvrPercent: 2.7,
    epcCents: 365,
    recommendedDailyVideos: 4,
    action: 'SCALE_AGGRESSIVE',
    reason: 'Consistent yield on Crypto audience',
  },
  {
    campaignId: 'camp-03',
    hookName: 'Dev Tool 10x Velocity',
    ctrPercent: 1.8,
    cvrPercent: 1.1,
    epcCents: 120,
    recommendedDailyVideos: 1,
    action: 'MAINTAIN_STEADY',
    reason: 'Moderate baseline engagement',
  },
];

export const DEFAULT_RECONCILIATION = {
  tenantId: 'default',
  totalGrossCommissionCents: 124850,
  totalHoldbackCents: 12485,
  totalNetPayableCents: 112365,
  totalRefundedCents: 0,
  totalOrdersProcessed: 86,
  highRiskRefundRate: false,
  entries: [],
};

export const TOP_HOOK_ARMS = [
  { name: 'Secret AI Tool Nobody Knows', niche: 'SaaS Global', rpm: '$48.20', ucbScore: 9.84, status: 'Exploiting' },
  { name: 'Solana Meme Breakout Alert', niche: 'Crypto Global', rpm: '$36.50', ucbScore: 7.92, status: 'Exploiting' },
  { name: 'Dev Tool 10x Velocity', niche: 'SaaS Global', rpm: '$12.00', ucbScore: 6.40, status: 'Exploring' },
];

export function AffiliateHookRankingTable({ locale }: { locale: string }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4 text-foreground">
        {locale === 'vi' ? 'Xếp Hạng Hook Video (Thuật toán UCB1 MAB)' : 'MAB UCB1 Hook Angle Rankings'}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{locale === 'vi' ? 'Tên Hook' : 'Hook Angle'}</th>
              <th className="px-4 py-3">{locale === 'vi' ? 'Thị Trường' : 'Niche'}</th>
              <th className="px-4 py-3">{locale === 'vi' ? 'Doanh Thu / 1k Lượt Xem' : 'RPM (Est.)'}</th>
              <th className="px-4 py-3">{locale === 'vi' ? 'Điểm UCB1' : 'UCB1 Score'}</th>
              <th className="px-4 py-3">{locale === 'vi' ? 'Trạng Thái' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TOP_HOOK_ARMS.map((arm, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium text-foreground">{arm.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{arm.niche}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600">{arm.rpm}</td>
                <td className="px-4 py-3 font-mono text-xs">{arm.ucbScore.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      arm.status === 'Exploiting'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {arm.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
