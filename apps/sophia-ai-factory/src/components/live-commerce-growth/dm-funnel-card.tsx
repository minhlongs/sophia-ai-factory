/**
 * @file dm-funnel-card.tsx
 * @description Cockpit Card for Comment-to-DM Trigger Router & Attribution
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { MessageSquareText, Users, Link2 } from 'lucide-react';

interface DmFunnelCardProps {
  onSimulateComment?: (keyword: string) => void;
}

export const DmFunnelCard: React.FC<DmFunnelCardProps> = ({ onSimulateComment }) => {
  const [activeLeads] = useState(142);
  const [conversionRate] = useState('28.4%');

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-emerald-400" />
          <h3 className="font-semibold text-base text-foreground">Comment-to-DM Funnel</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
          ● ACTIVE 24/7
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Leads Trong Phễu:</span>
          </div>
          <span className="font-semibold text-foreground">{activeLeads} Leads</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link2 className="h-4 w-4" />
            <span>Tỷ Lệ Chuyển Đổi Click:</span>
          </div>
          <span className="font-semibold text-primary">{conversionRate}</span>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs">
          <p className="font-medium text-muted-foreground mb-1">Keywords Giám Sát Tự Động:</p>
          <div className="flex flex-wrap gap-1.5">
            {['ib', 'inbox', 'link', 'giá', 'deal', 'tư vấn'].map((kw) => (
              <span key={kw} className="rounded bg-background px-1.5 py-0.5 text-[11px] font-mono border border-border">
                #{kw}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSimulateComment?.('ib')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Mô Phỏng Comment Mua Hàng
        </button>
      </div>
    </div>
  );
};
