/**
 * Agency Recent Deliverables & Revenue Attribution Cards
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/campaign-revenue-cards
 */

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Video, DollarSign, Calendar } from 'lucide-react';
import { CampaignBadge, VelocityBadge } from './badges';
import type { AgencyCampaignSummary, AgencyRevenueAttribution } from './types';

export interface CampaignRevenueCardsProps {
  campaigns: AgencyCampaignSummary[];
  revenues: AgencyRevenueAttribution[];
  locale: 'en' | 'vi';
  isVi: boolean;
}

export function CampaignRevenueCards({
  campaigns,
  revenues,
  locale,
  isVi,
}: CampaignRevenueCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Video Campaigns / Deliverables in Flight */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-foreground">
              {isVi ? 'Bản Thảo Video Đang Xử Lý' : 'Video Deliverables in Review'}
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {campaigns.length} {isVi ? 'chiến dịch' : 'campaigns'}
          </span>
        </div>

        <div className="divide-y divide-border/50 flex-1 overflow-y-auto max-h-80">
          {campaigns.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {isVi ? 'Chưa có chiến dịch video nào.' : 'No active video deliverables found.'}
            </div>
          ) : (
            campaigns.map((camp) => (
              <div key={camp.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{camp.title}</span>
                    <CampaignBadge status={camp.status} isVi={isVi} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {camp.clientName} • {camp.rendersCount} {isVi ? 'lượt render' : 'renders'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {camp.mcuConsumed} MCU
                  </span>
                  <Link
                    href={`/${locale}/agency/review/${camp.id}`}
                    target="_blank"
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={isVi ? 'Mở cổng duyệt video' : 'Open client review portal'}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Revenue Attribution by Client Workspace */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-foreground">
              {isVi ? 'Phân Bổ Doanh Thu Danh Mục' : 'Revenue Attribution'}
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            USD / {isVi ? 'tháng' : 'month'}
          </span>
        </div>

        <div className="divide-y divide-border/50 flex-1 overflow-y-auto max-h-80">
          {revenues.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {isVi ? 'Chưa có dữ liệu phân bổ doanh thu.' : 'No revenue records available.'}
            </div>
          ) : (
            revenues.map((rev) => (
              <div key={rev.subaccountId} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{rev.clientName}</span>
                    <VelocityBadge status={rev.velocityStatus} isVi={isVi} />
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{rev.tier} • {rev.mcuConsumed} MCU</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-foreground">
                    ${rev.mrrUsd.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-500 font-medium">
                    +{rev.marginPercent}% {isVi ? 'biên lợi nhuận' : 'margin'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
