/**
 * @file b2b-outreach-cockpit.tsx
 * @description Presentation component for B2B Multi-Channel Cold Outreach Engine
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type { B2bLeadRecord } from '@/seed/types/growth-triad-v3-types';

interface B2bOutreachCockpitProps {
  leads: B2bLeadRecord[];
  onDispatchLead?: (leadId: string) => void;
}

export function B2bOutreachCockpit({
  leads,
  onDispatchLead,
}: B2bOutreachCockpitProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    leads[0]?.id ?? null
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>✉️</span> B2B Multi-Channel Cold Outreach Engine
          </h3>
          <p className="text-xs text-slate-400">
            Tự động ramp-up mailbox, kiểm tra corporate domain & CAN-SPAM HMAC
          </p>
        </div>
        <span className="text-xs bg-amber-950 border border-amber-600 text-amber-400 px-2 py-0.5 rounded-full font-mono">
          Ramp Cap: 50 emails/day
        </span>
      </div>

      <div className="space-y-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => setSelectedLeadId(lead.id)}
            className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
              selectedLeadId === lead.id
                ? 'bg-slate-950 border-amber-500/50 ring-1 ring-amber-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">
                {lead.fullName || lead.email} ({lead.companyDomain})
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  lead.status === 'CONTACTED'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : lead.status === 'WARMING'
                    ? 'bg-amber-900/60 text-amber-300'
                    : 'bg-rose-900/60 text-rose-300'
                }`}
              >
                {lead.status}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Kênh: {lead.channel} | Điểm Intent: {lead.intentScore}</span>
              <span>
                {lead.isCorporateDomain ? '🏢 Corporate' : '⚠️ Public Domain'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => selectedLeadId && onDispatchLead?.(selectedLeadId)}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs py-2 rounded-lg transition"
      >
        Kích Hoạt Cold Outreach Sequence
      </button>
    </div>
  );
}
