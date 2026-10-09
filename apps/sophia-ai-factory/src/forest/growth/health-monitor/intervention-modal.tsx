/**
 * 1-Click Founder Intervention Modal
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/intervention-modal
 */

import React from 'react';
import {
  Sparkles,
  X,
  RefreshCw,
  Zap,
  Mail,
  Send,
} from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';

interface InterventionModalProps {
  activeCustomer: CustomerHealthMetrics | null;
  onClose: () => void;
  isVi: boolean;
  bonusCredits: number;
  setBonusCredits: (credits: number) => void;
  customNote: string;
  setCustomNote: (note: string) => void;
  notifyEmail: boolean;
  setNotifyEmail: (notify: boolean) => void;
  notifyTelegram: boolean;
  setNotifyTelegram: (notify: boolean) => void;
  isSubmitting: boolean;
  onExecute: () => Promise<void>;
}

export function InterventionModal({
  activeCustomer,
  onClose,
  isVi,
  bonusCredits,
  setBonusCredits,
  customNote,
  setCustomNote,
  notifyEmail,
  setNotifyEmail,
  notifyTelegram,
  setNotifyTelegram,
  isSubmitting,
  onExecute,
}: InterventionModalProps) {
  if (!activeCustomer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span>
              {isVi
                ? 'Can Thiệp Giữ Chân Khách Hàng 1-Click'
                : '1-Click Founder Intervention'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target customer card */}
        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div>
            <div className="font-semibold text-white text-sm">
              {activeCustomer.userName || activeCustomer.userEmail.split('@')[0]}
            </div>
            <div className="text-xs text-zinc-400">{activeCustomer.userEmail}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              ID: {activeCustomer.userId}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">
              {isVi ? 'Điểm sức khỏe' : 'Health Score'}
            </div>
            <div
              className={`text-lg font-bold font-mono ${
                activeCustomer.totalHealthScore < 40
                  ? 'text-rose-400'
                  : activeCustomer.totalHealthScore < 70
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {activeCustomer.totalHealthScore}/100
            </div>
          </div>
        </div>

        {/* Bonus MCU Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 block">
            {isVi ? 'Tặng MCU ưu đãi (Model Compute Units):' : 'Grant Bonus MCU (Compute Units):'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[250, 500, 1000, 2500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBonusCredits(amt)}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                  bonusCredits === amt
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                +{amt} MCU
              </button>
            ))}
          </div>
        </div>

        {/* Personalized Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 block">
            {isVi ? 'Tin nhắn riêng từ Founder (Tùy chọn):' : 'Personal Founder Message (Optional):'}
          </label>
          <textarea
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder={
              isVi
                ? 'Tôi nhận thấy bạn đang gặp vướng mắc khi render video. Tôi tặng bạn 500 MCU để trải nghiệm thêm nhé!'
                : 'Noticed your video runs slowed down. Here is a 500 MCU gift from me to keep creating!'
            }
            rows={3}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Notification checkboxes */}
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

        {/* Action buttons */}
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
      </div>
    </div>
  );
}
