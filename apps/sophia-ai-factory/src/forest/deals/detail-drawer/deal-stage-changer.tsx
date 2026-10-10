'use client';

/**
 * Deal Pipeline Stage Selector
 *
 * Layer: forest/deals/detail-drawer
 */

import React, { useState } from 'react';
import type { DealStage } from '@/seed/types/enterprise-deal';

interface DealStageChangerProps {
  currentStage: DealStage;
  onStageChange: (stage: DealStage) => Promise<void>;
}

export function DealStageChanger({ currentStage, onStageChange }: DealStageChangerProps) {
  const [updatingStage, setUpdatingStage] = useState(false);

  const handleStageSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      setUpdatingStage(true);
      await onStageChange(e.target.value as DealStage);
    } finally {
      setUpdatingStage(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
      <label className="block text-zinc-400 font-medium">Deal Pipeline Stage</label>
      <select
        value={currentStage}
        disabled={updatingStage}
        onChange={handleStageSelect}
        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-medium capitalize"
      >
        <option value="new_lead">New Lead</option>
        <option value="enriching">Enriching</option>
        <option value="qualified">Qualified</option>
        <option value="demo_prepared">Demo Prepared</option>
        <option value="demo_active">Demo Active (Sandbox)</option>
        <option value="proposal_sent">Proposal Sent</option>
        <option value="negotiating">Negotiating</option>
        <option value="closed_won">Closed Won 🎉</option>
        <option value="closed_lost">Closed Lost</option>
      </select>
    </div>
  );
}
