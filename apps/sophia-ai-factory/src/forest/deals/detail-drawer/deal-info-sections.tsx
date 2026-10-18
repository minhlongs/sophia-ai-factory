'use client';

/**
 * Deal Stakeholder, Intelligence, and Commercial Sections
 *
 * Layer: forest/deals/detail-drawer
 */

import React from 'react';
import {
  DollarSign,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
} from '@/seed/types/enterprise-deal';
import { DealEnrichmentCard } from './deal-enrichment-card';

interface DealInfoSectionsProps {
  deal: EnterpriseDeal;
  enrichment: EnterpriseLeadEnrichment | null;
}

export function DealInfoSections({ deal, enrichment }: DealInfoSectionsProps) {
  return (
    <>
      {/* Lead Stakeholder Details */}
      <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
        <span className="font-semibold text-zinc-200 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-400" /> Stakeholder Information
        </span>
        <div className="grid grid-cols-2 gap-3 text-zinc-300">
          <div>
            <span className="text-zinc-500 block text-[11px]">Full Name</span>
            <span className="font-medium text-white">{deal.leadName}</span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Job Title</span>
            <span>{deal.leadTitle || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <Mail className="w-3.5 h-3.5 text-zinc-500" />
            <a href={`mailto:${deal.leadEmail}`} className="text-blue-400 hover:underline">
              {deal.leadEmail}
            </a>
          </div>
          {deal.leadPhone && (
            <div className="flex items-center gap-1.5 col-span-2">
              <Phone className="w-3.5 h-3.5 text-zinc-500" />
              <span>{deal.leadPhone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Enriched Intelligence */}
      <DealEnrichmentCard enrichment={enrichment} />

      {/* Commercial Estimates */}
      <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
        <span className="font-semibold text-zinc-200 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" /> Commercial Terms
        </span>
        <div className="grid grid-cols-2 gap-3 text-zinc-300">
          <div>
            <span className="text-zinc-500 block text-[11px]">Estimated Contract Value</span>
            <span className="text-base font-bold text-white">
              ${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()} {deal.currency}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Monthly MCUs Requested</span>
            <span className="text-base font-bold text-white">
              {deal.requestedMcuMonthly.toLocaleString()} MCU
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
