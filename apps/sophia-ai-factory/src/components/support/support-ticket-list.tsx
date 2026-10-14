'use client';

import React from 'react';
import { Clock } from 'lucide-react';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string | number;
  title: string | null;
  message: string;
  status: string;
  priority: TicketPriority;
  created_at: string;
}

export const PRIORITY_LABELS: Record<TicketPriority, { vi: string; en: string }> = {
  low: { vi: 'Thấp', en: 'Low' },
  normal: { vi: 'Bình thường', en: 'Normal' },
  high: { vi: 'Cao', en: 'High' },
  urgent: { vi: 'Khẩn cấp', en: 'Urgent' },
};

export function SupportTicketList({
  tickets,
  isLoadingTickets,
  isVi,
}: {
  tickets: SupportTicket[];
  isLoadingTickets: boolean;
  isVi: boolean;
}) {
  return (
    <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1 text-sm">
      {isLoadingTickets && (
        <p className="py-6 text-center text-xs text-on-surface-variant">
          {isVi ? 'Đang tải danh sách...' : 'Loading tickets...'}
        </p>
      )}
      {!isLoadingTickets && tickets.length === 0 && (
        <p className="py-8 text-center text-xs text-on-surface-variant">
          {isVi ? 'Bạn chưa có ticket hỗ trợ nào.' : 'You have no open support tickets.'}
        </p>
      )}
      {!isLoadingTickets &&
        tickets.map((t) => (
          <div key={t.id} className="rounded-xl border border-outline-variant/30 bg-surface-variant/10 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-on-surface">
                {t.title || (isVi ? 'Không tiêu đề' : 'Untitled')}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                  {t.status}
                </span>
                <span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant uppercase">
                  {t.priority}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2">{t.message}</p>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-on-surface-variant/70">
              <Clock className="h-3 w-3" />
              <span>{new Date(t.created_at).toLocaleString(isVi ? 'vi-VN' : 'en-US')}</span>
            </div>
          </div>
        ))}
    </div>
  );
}
