'use client';

/**
 * New Enterprise Deal Modal View & Submission Orchestrator
 *
 * Layer: forest/deals/new-deal
 */

import React, { useState } from 'react';
import type { CreateEnterpriseDealInput } from '@/seed/types/enterprise-deal';
import {
  type NewDealModalProps,
  type NewDealFormState,
  INITIAL_NEW_DEAL_FORM_STATE,
} from './types';
import { DealModalHeader, DealModalFooter } from './deal-modal-chrome';
import { DealContactFields } from './deal-contact-fields';
import { DealCommercialFields } from './deal-commercial-fields';

export function NewDealModalView({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: NewDealModalProps) {
  const [form, setForm] = useState<NewDealFormState>(INITIAL_NEW_DEAL_FORM_STATE);

  if (!isOpen) return null;

  const updateForm = (updates: Partial<NewDealFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { leadName, leadEmail, companyName, companyDomain } = form;
    if (!leadName || !leadEmail || !companyName || !companyDomain) return;

    const dealValueEstimateCents = Math.round(parseFloat(form.dealValueDollars || '0') * 100);
    const mcu = parseInt(form.requestedMcuMonthly || '0', 10);

    const input: CreateEnterpriseDealInput = {
      leadName,
      leadEmail,
      leadPhone: form.leadPhone || null,
      leadTitle: form.leadTitle || null,
      companyName,
      companyDomain: companyDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0],
      leadSource: form.leadSource,
      dealStage: 'new_lead',
      dealValueEstimateCents,
      currency: 'USD',
      requestedMcuMonthly: mcu,
      notes: form.notes || null,
      bantInput: {
        statedBudgetArr: parseFloat(form.dealValueDollars || '0'),
        statedMonthlyMcu: mcu,
        jobTitle: form.leadTitle,
        leadEmail,
        timeframe: form.timeframe,
        needsHighVolumeSyndication: form.needsHighVolumeSyndication,
        needsApacDubbing: form.needsApacDubbing,
        needsDedicatedGpuLane: form.needsDedicatedGpuLane,
        needsCustomApiOrWhiteLabel: form.needsCustomApiOrWhiteLabel,
        statedBottleneckOrPainPoint: form.notes,
      },
    };

    await onSubmit(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        <DealModalHeader onClose={onClose} />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <DealContactFields form={form} updateForm={updateForm} />
          <DealCommercialFields form={form} updateForm={updateForm} />
          <DealModalFooter onClose={onClose} isLoading={isLoading} />
        </form>
      </div>
    </div>
  );
}
