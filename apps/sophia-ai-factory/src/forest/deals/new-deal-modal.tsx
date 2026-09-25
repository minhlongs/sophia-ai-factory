'use client';

/**
 * Ingest New Enterprise Lead & Deal Modal
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/new-deal-modal
 */

import React, { useState } from 'react';
import { X, Plus, Sparkles, Building2, User, Mail, DollarSign, Calendar } from 'lucide-react';
import type {
  CreateEnterpriseDealInput,
  DealSource,
} from '@/seed/types/enterprise-deal';

interface NewDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEnterpriseDealInput) => Promise<void>;
  isLoading?: boolean;
}

export function NewDealModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: NewDealModalProps) {
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadTitle, setLeadTitle] = useState('VP of Marketing & Production');
  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [leadSource, setLeadSource] = useState<DealSource>('website');
  const [dealValueDollars, setDealValueDollars] = useState('54000');
  const [requestedMcuMonthly, setRequestedMcuMonthly] = useState('100000');
  const [timeframe, setTimeframe] = useState('immediate');
  const [needsHighVolumeSyndication, setNeedsHighVolumeSyndication] = useState(true);
  const [needsApacDubbing, setNeedsApacDubbing] = useState(true);
  const [needsDedicatedGpuLane, setNeedsDedicatedGpuLane] = useState(true);
  const [needsCustomApiOrWhiteLabel, setNeedsCustomApiOrWhiteLabel] = useState(false);
  const [notes, setNotes] = useState('Seeking automated video dubbing across 5 APAC languages and high-volume TikTok/Shorts syndication.');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadEmail || !companyName || !companyDomain) return;

    const dealValueEstimateCents = Math.round(parseFloat(dealValueDollars || '0') * 100);
    const mcu = parseInt(requestedMcuMonthly || '0', 10);

    const input: CreateEnterpriseDealInput = {
      leadName,
      leadEmail,
      leadPhone: leadPhone || null,
      leadTitle: leadTitle || null,
      companyName,
      companyDomain: companyDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0],
      leadSource,
      dealStage: 'new_lead',
      dealValueEstimateCents,
      currency: 'USD',
      requestedMcuMonthly: mcu,
      notes: notes || null,
      bantInput: {
        statedBudgetArr: parseFloat(dealValueDollars || '0'),
        statedMonthlyMcu: mcu,
        jobTitle: leadTitle,
        leadEmail,
        timeframe,
        needsHighVolumeSyndication,
        needsApacDubbing,
        needsDedicatedGpuLane,
        needsCustomApiOrWhiteLabel,
        statedBottleneckOrPainPoint: notes,
      },
    };

    await onSubmit(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Ingest New Enterprise Deal</h2>
              <p className="text-xs text-zinc-400">
                Adds lead to autonomous BANT qualification & sales pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">Company Name *</label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. VNG Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Company Domain *</label>
              <input
                type="text"
                required
                placeholder="e.g. vng.com.vn"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">Lead Contact Name *</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Minh Nguyen"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Lead Email *</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="e.g. minh.nguyen@vng.com.vn"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">Lead Title / Role</label>
              <input
                type="text"
                placeholder="e.g. VP of Digital Media"
                value={leadTitle}
                onChange={(e) => setLeadTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Lead Source</label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as DealSource)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="website">Website Direct</option>
                <option value="inbound_form">Inbound Form</option>
                <option value="telegram">Telegram Bot</option>
                <option value="outbound">Outbound Sales</option>
                <option value="referral">Referral Partner</option>
                <option value="event">Industry Summit / Event</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">Estimated ARR ($ USD)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="number"
                  value={dealValueDollars}
                  onChange={(e) => setDealValueDollars(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Requested MCU/Month</label>
              <input
                type="number"
                value={requestedMcuMonthly}
                onChange={(e) => setRequestedMcuMonthly(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Implementation Timeline</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
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
                  checked={needsHighVolumeSyndication}
                  onChange={(e) => setNeedsHighVolumeSyndication(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-zinc-300">Multi-Channel Syndication (YT/TikTok)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
                <input
                  type="checkbox"
                  checked={needsApacDubbing}
                  onChange={(e) => setNeedsApacDubbing(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-zinc-300">APAC 5-Language Voice Dubbing</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
                <input
                  type="checkbox"
                  checked={needsDedicatedGpuLane}
                  onChange={(e) => setNeedsDedicatedGpuLane(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-zinc-300">Dedicated Priority GPU Lane &amp; SLA</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
                <input
                  type="checkbox"
                  checked={needsCustomApiOrWhiteLabel}
                  onChange={(e) => setNeedsCustomApiOrWhiteLabel(e.target.checked)}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isLoading ? 'Creating & Qualifying...' : 'Create & Qualify Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
