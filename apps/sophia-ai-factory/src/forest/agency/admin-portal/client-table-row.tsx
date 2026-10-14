'use client';

/**
 * Single client row for Agency Admin Portal ClientTable.
 * @module forest/agency/admin-portal/client-table-row
 */

import React from 'react';
import { Sliders, CheckCircle2, Ban } from 'lucide-react';
import { VelocityBadge } from './badges';
import type { AgencyClientSummary, VelocityAlertStatus } from './types';

export function AgencyClientTableRow({
  client,
  isVi,
  onOpenQuotaModal,
  onToggleStatus,
}: {
  client: AgencyClientSummary;
  isVi: boolean;
  onOpenQuotaModal: (client: AgencyClientSummary) => void;
  onToggleStatus: (subaccountId: string, newStatus: 'active' | 'suspended') => Promise<void>;
}) {
  const alertStatus: VelocityAlertStatus =
    client.mcuUtilizationRate >= 100
      ? 'exceeded'
      : client.mcuUtilizationRate >= 80
        ? 'near_limit'
        : 'normal';

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="py-3.5 px-3">
        <div className="font-semibold text-foreground">{client.name}</div>
        <div className="text-[11px] text-muted-foreground font-mono">{client.id}</div>
      </td>
      <td className="py-3.5 px-3">
        {client.status === 'active' ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            {isVi ? 'Hoạt Động' : 'Active'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
            <Ban className="w-3 h-3" />
            {isVi ? 'Tạm Khóa' : 'Suspended'}
          </span>
        )}
      </td>
      <td className="py-3.5 px-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-foreground">
            {client.usedMcu} / {client.allocatedMcu} MCU
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({client.mcuUtilizationRate}%)
          </span>
        </div>
        <div className="w-32 bg-muted rounded-full h-1 mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              alertStatus === 'exceeded'
                ? 'bg-rose-500'
                : alertStatus === 'near_limit'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{
              width: `${Math.min(100, client.mcuUtilizationRate)}%`,
            }}
          />
        </div>
      </td>
      <td className="py-3.5 px-3">
        <VelocityBadge status={alertStatus} isVi={isVi} />
      </td>
      <td className="py-3.5 px-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={() => onOpenQuotaModal(client)}
            title={isVi ? 'Điều chỉnh hạn mức MCU' : 'Reallocate MCU'}
            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          {client.status === 'active' ? (
            <button
              onClick={() => onToggleStatus(client.id, 'suspended')}
              title={isVi ? 'Tạm khóa khách hàng' : 'Suspend client'}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onToggleStatus(client.id, 'active')}
              title={isVi ? 'Kích hoạt lại' : 'Activate client'}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
