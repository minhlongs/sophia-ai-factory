'use client';

/**
 * Enterprise Deal Contact & Organization Form Inputs
 *
 * Layer: forest/deals/new-deal
 */

import React from 'react';
import { Building2, User, Mail } from 'lucide-react';
import type { DealSource } from '@/seed/types/enterprise-deal';
import type { NewDealFormState } from './types';

interface DealContactFieldsProps {
  form: NewDealFormState;
  updateForm: (updates: Partial<NewDealFormState>) => void;
}

export function DealContactFields({ form, updateForm }: DealContactFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium text-zinc-300 mb-1">Company Name *</label>
          <div className="relative">
            <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              required
              placeholder="e.g. VNG Corporation"
              value={form.companyName}
              onChange={(e) => updateForm({ companyName: e.target.value })}
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
            value={form.companyDomain}
            onChange={(e) => updateForm({ companyDomain: e.target.value })}
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
              value={form.leadName}
              onChange={(e) => updateForm({ leadName: e.target.value })}
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
              value={form.leadEmail}
              onChange={(e) => updateForm({ leadEmail: e.target.value })}
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
            value={form.leadTitle}
            onChange={(e) => updateForm({ leadTitle: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block font-medium text-zinc-300 mb-1">Lead Source</label>
          <select
            value={form.leadSource}
            onChange={(e) => updateForm({ leadSource: e.target.value as DealSource })}
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
    </>
  );
}
