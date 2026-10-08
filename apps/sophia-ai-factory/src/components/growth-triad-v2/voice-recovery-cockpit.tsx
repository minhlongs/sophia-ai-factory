/**
 * @file voice-recovery-cockpit.tsx
 * @description Presentation component for AI Voice Cart Closer
 */

'use client';

import React, { useState } from 'react';
import type { AbandonedCartCallRecord } from '@/seed/types/growth-triad-v2-types';

interface VoiceRecoveryCockpitProps {
  calls: AbandonedCartCallRecord[];
  onTriggerCall?: (cartSessionId: string) => void;
}

export function VoiceRecoveryCockpit({ calls, onTriggerCall }: VoiceRecoveryCockpitProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(calls[0]?.id ?? null);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>📞</span> AI Voice Cart Closer (TCPA Compliant)
          </h3>
          <p className="text-xs text-slate-400">Tự động gọi chốt đơn & xử lý từ chối trong vòng 90 giây</p>
        </div>
        <span className="text-xs bg-emerald-950 border border-emerald-600 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
          Safe Window: 09:00 - 20:00
        </span>
      </div>

      <div className="space-y-3">
        {calls.map((call) => (
          <div
            key={call.id}
            onClick={() => setSelectedCallId(call.id)}
            className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
              selectedCallId === call.id
                ? 'bg-slate-950 border-amber-500/50 ring-1 ring-amber-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">
                {call.customerName || 'Khách Vãng Lai'} ({call.customerPhone})
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  call.callStatus === 'RECOVERED_CONVERTED'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : 'bg-amber-900/60 text-amber-300'
                }`}
              >
                {call.callStatus}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Giá trị: {call.cartValue.toLocaleString()} {call.currency}</span>
              <span>Voucher: {call.offeredVoucherCode || 'Chưa cấp'}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => selectedCallId && onTriggerCall?.(selectedCallId)}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs py-2 rounded-lg transition"
      >
        Kích Hoạt Auto-Dialer Test
      </button>
    </div>
  );
}
