'use client';

/**
 * Agency Quota Summary & Input Fields
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/quota-modal-fields
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { AgencyClientSummary } from './types';

export interface QuotaModalFieldsProps {
  client: AgencyClientSummary;
  quota: number;
  setQuota: (value: number) => void;
  error: string | null;
  isVi: boolean;
}

export function QuotaModalFields({
  client,
  quota,
  setQuota,
  error,
  isVi,
}: QuotaModalFieldsProps) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">
          {isVi ? 'Khách Hàng' : 'Client Workspace'}
        </label>
        <p className="text-sm font-bold text-foreground">{client.name}</p>
        <p className="text-xs text-muted-foreground font-mono">{client.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border/50 text-xs">
        <div>
          <span className="text-muted-foreground">
            {isVi ? 'Đã sử dụng:' : 'Currently Used:'}
          </span>
          <p className="font-bold text-foreground font-mono text-sm mt-0.5">
            {client.usedMcu} MCU
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">
            {isVi ? 'Hạn mức cũ:' : 'Current Quota:'}
          </span>
          <p className="font-bold text-foreground font-mono text-sm mt-0.5">
            {client.allocatedMcu} MCU
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="quota-input"
          className="text-xs font-semibold text-muted-foreground block mb-1"
        >
          {isVi ? 'Hạn Mức MCU Mới' : 'New MCU Quota'}
        </label>
        <input
          id="quota-input"
          type="number"
          min={client.usedMcu}
          step={10}
          value={quota}
          onChange={(e) => setQuota(Number(e.target.value))}
          className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          required
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          {isVi
            ? 'Đơn vị tính: 1 MCU = 1 lượt render video 60s độ phân giải cao'
            : '1 MCU = 1 standard 60s high-definition video render unit'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-500 rounded-xl text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </>
  );
}
