/**
 * @file competitor-prospecting-card.tsx
 * @description Autonomous Competitor Comment Prospecting & Lead Outreach Card
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { Target, Users, SendHorizontal, ShieldCheck } from 'lucide-react';

export const CompetitorProspectingCard: React.FC = () => {
  const [leadStatus, setLeadStatus] = useState<'IDLE' | 'SCANNED' | 'DISPATCHED'>('SCANNED');

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-base text-foreground">Competitor Prospecting</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500 border border-blue-500/20">
          <Users className="h-3 w-3" />
          AUTO PROSPECT
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Đối thủ mục tiêu:</span>
          <span className="font-semibold text-foreground">TikTok #review_congnghe</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Intent Score phát hiện:</span>
          <span className="font-bold text-emerald-500">96/100 (Hỏi link mua)</span>
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-blue-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Thông điệp Outreach Chuẩn Bị:</span>
          </div>
          <p className="italic text-muted-foreground">
            &ldquo;Chào bạn! Mẫu sản phẩm tương tự đang được trợ giá độc quyền 25% kèm voucher 30k...&rdquo;
          </p>
        </div>

        <button
          type="button"
          onClick={() => setLeadStatus('DISPATCHED')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <SendHorizontal className="h-3.5 w-3.5" />
          {leadStatus === 'DISPATCHED' ? 'Đã Gửi DM Tự Động' : 'Quét & Gửi DM Ngay'}
        </button>
      </div>
    </div>
  );
};
