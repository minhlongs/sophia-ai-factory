/**
 * 1-Click Founder Intervention Modal
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/intervention-modal
 */

import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';
import {
  InterventionCustomerSummary,
  InterventionNotificationAndFooter,
} from './intervention-modal-sections';

export interface InterventionModalProps {
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
            <span>{isVi ? 'Can Thiệp Giữ Chân Khách Hàng 1-Click' : '1-Click Founder Intervention'}</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <InterventionCustomerSummary activeCustomer={activeCustomer} isVi={isVi} />

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

        <InterventionNotificationAndFooter
          isVi={isVi}
          notifyEmail={notifyEmail}
          setNotifyEmail={setNotifyEmail}
          notifyTelegram={notifyTelegram}
          setNotifyTelegram={setNotifyTelegram}
          isSubmitting={isSubmitting}
          onClose={onClose}
          onExecute={onExecute}
        />
      </div>
    </div>
  );
}
