'use client';

/**
 * Enterprise Deal Commercials & BANT Requirements Form Fields
 *
 * Layer: forest/deals/new-deal
 */

import React from 'react';
import { DollarSign, Calendar } from 'lucide-react';
import type { NewDealFormState } from './types';

interface DealCommercialFieldsProps {
  form: NewDealFormState;
  updateForm: (updates: Partial<NewDealFormState>) => void;
}

export function DealCommercialFields({ form, updateForm }: DealCommercialFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
        <div>
          <label className="block font-medium text-zinc-300 mb-1">Estimated ARR ($ USD)</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="number"
              value={form.dealValueDollars}
              onChange={(e) => updateForm({ dealValueDollars: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium text-zinc-300 mb-1">Requested MCU/Month</label>
          <input
            type="number"
            value={form.requestedMcuMonthly}
            onChange={(e) => updateForm({ requestedMcuMonthly: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block font-medium text-zinc-300 mb-1">Implementation Timeline</label>
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <select
              value={form.timeframe}
              onChange={(e) => updateForm({ timeframe: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="immediate">Immediate (&lt; 1 month)</option>
              <option value="1_to_3_months">1–3 months (This quarter)</option>
              <option value="3_to_6_months">3–6 months</option>
              <option value="6_to_12_months">6–12 months</option>
              <option value="exploring">Just exploring</option>
            </select>
          </div>
        </div>
      </div>

      {/* Need Checkboxes */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <span className="block font-medium text-zinc-300">Technical Requirements (BANT Need):</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
            <input
              type="checkbox"
              checked={form.needsHighVolumeSyndication}
              onChange={(e) => updateForm({ needsHighVolumeSyndication: e.target.checked })}
              className="rounded text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-zinc-300">Multi-Channel Syndication (YT/TikTok)</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
            <input
              type="checkbox"
              checked={form.needsApacDubbing}
              onChange={(e) => updateForm({ needsApacDubbing: e.target.checked })}
              className="rounded text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-zinc-300">APAC 5-Language Voice Dubbing</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
            <input
              type="checkbox"
              checked={form.needsDedicatedGpuLane}
              onChange={(e) => updateForm({ needsDedicatedGpuLane: e.target.checked })}
              className="rounded text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-zinc-300">Dedicated Priority GPU Lane &amp; SLA</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
            <input
              type="checkbox"
              checked={form.needsCustomApiOrWhiteLabel}
              onChange={(e) => updateForm({ needsCustomApiOrWhiteLabel: e.target.checked })}
              className="rounded text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-zinc-300">Agency White-Label &amp; Custom API</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block font-medium text-zinc-300 mb-1">Pain Points &amp; Operational Notes</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => updateForm({ notes: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
        />
      </div>
    </>
  );
}
