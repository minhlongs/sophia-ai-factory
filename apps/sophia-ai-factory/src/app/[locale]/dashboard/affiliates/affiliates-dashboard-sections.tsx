/**
2 * Static default snapshots and UCB1 Hook Ranking Table for Affiliates Dashboard.
3 * @module app/[locale]/dashboard/affiliates/affiliates-dashboard-sections
4 */

import React from 'react';

export interface AffiliateMetrics {
  totalVideosGenerated: number;
  totalBridgeClicks: number;
  totalCommissionUsd: number;
  activeNiches: string[];
}

export const EMPTY_AFFILIATE_METRICS: AffiliateMetrics = {
  totalVideosGenerated: 0,
  totalBridgeClicks: 0,
  totalCommissionUsd: 0,
  activeNiches: [],
};

export const EMPTY_RECONCILIATION = {
  tenantId: '',
  totalGrossCommissionCents: 0,
  totalHoldbackCents: 0,
  totalNetPayableCents: 0,
  totalRefundedCents: 0,
  totalOrdersProcessed: 0,
  highRiskRefundRate: false,
  entries: [],
};

export interface HookArmEntry {
  name: string;
  niche: string;
  rpm: string;
  ucbScore: number;
  status: string;
}

export function AffiliateHookRankingTable({
  locale,
  hooks = [],
}: {
  locale: string;
  hooks?: HookArmEntry[];
}) {
  const isVi = locale === 'vi';

  return (
    <div className="rounded-xl border bg-card shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4 text-foreground">
        {isVi ? 'Xếp Hạng Hook Video (Thuật toán UCB1 MAB)' : 'MAB UCB1 Hook Angle Rankings'}
      </h2>
      {hooks.length === 0 ? (
        <div
          data-testid="mab-hooks-empty-state"
          className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground"
        >
          {isVi
            ? 'Chưa có dữ liệu phân tích video hook cho Workspace này. Hệ thống sẽ bắt đầu xếp hạng sau khi video đầu tiên được sản xuất và đo lường.'
            : 'No video hook analytics available for this workspace yet. Rankings will appear once the first campaign is syndicated.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{isVi ? 'Tên Hook' : 'Hook Angle'}</th>
                <th className="px-4 py-3">{isVi ? 'Thị Trường' : 'Niche'}</th>
                <th className="px-4 py-3">{isVi ? 'Doanh Thu / 1k Lượt Xem' : 'RPM (Est.)'}</th>
                <th className="px-4 py-3">{isVi ? 'Điểm UCB1' : 'UCB1 Score'}</th>
                <th className="px-4 py-3">{isVi ? 'Trạng Thái' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hooks.map((arm, idx) => (
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
      )}
    </div>
  );
}
