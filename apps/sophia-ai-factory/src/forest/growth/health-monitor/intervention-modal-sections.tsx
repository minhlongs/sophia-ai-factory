'use client';

/**
 * 1-Click Founder Intervention Modal — Subcomponents & Form Sections
 *
 * Layer: Forest (UI components & presentation)
 *
 * @module forest/growth/health-monitor/intervention-modal-sections
 */

import React from 'react';
import { RefreshCw, Zap, Mail, Send } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';

export interface InterventionCustomerSummaryProps {
  activeCustomer: CustomerHealthMetrics;
  isVi: boolean;
}

export function InterventionCustomerSummary({
  activeCustomer,
  isVi,
}: InterventionCustomerSummaryProps) {
  const scoreColor =
    activeCustomer.totalHealthScore < 40
      ? 'text-rose-400'
      : activeCustomer.totalHealthScore < 70
        ? 'text-amber-400'
        : 'text-emerald-400';

  return (
    <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between">
      <div>
        <div className="font-semibold text-white text-sm">
          {activeCustomer.userName || activeCustomer.userEmail.split('@')[0]}
        </div>
        <div className="text-xs text-zinc-400">{activeCustomer.userEmail}</div>
        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {activeCustomer.userId}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-zinc-400 uppercase font-semibold">
          {isVi ? 'Điểm sức khỏe' : 'Health Score'}
        </div>
        <div className={`text-lg font-bold font-mono ${scoreColor}`}>
          {activeCustomer.totalHealthScore}/100
        </div>
      </div>
    </div>
  );
}

export interface InterventionNotificationAndFooterProps {
  isVi: boolean;
  notifyEmail: boolean;
  setNotifyEmail: (notify: boolean) => void;
  notifyTelegram: boolean;
  setNotifyTelegram: (notify: boolean) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onExecute: () => Promise<void>;
}

export function InterventionNotificationAndFooter({
  isVi,
  notifyEmail,
  setNotifyEmail,
  notifyTelegram,
  setNotifyTelegram,
  isSubmitting,
  onClose,
  onExecute,
}: InterventionNotificationAndFooterProps) {
  return (
    <>
      <div className="space-y-2 pt-1 border-t border-zinc-800 text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0"
          />
          <Mail className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isVi ? 'Gửi email thông báo cá nhân qua Resend' : 'Send personal email via Resend'}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
          <input
            type="checkbox"
            checked={notifyTelegram}
            onChange={(e) => setNotifyTelegram(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0"
          />
          <Send className="w-3.5 h-3.5 text-blue-400" />
          <span>{isVi ? 'Gửi thông báo xác nhận về Telegram Founder' : 'Send confirmation to Founder Telegram'}</span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition"
        >
          {isVi ? 'Hủy' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => void onExecute()}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{isVi ? 'Đang thực hiện...' : 'Executing...'}</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>{isVi ? 'Xác nhận Can thiệp' : 'Execute Intervention'}</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
