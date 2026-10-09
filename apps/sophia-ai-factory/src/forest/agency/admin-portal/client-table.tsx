/**
 * Agency Clients List & Management Table
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/client-table
 */

import React, { useState } from 'react';
import { Search, Sliders, CheckCircle2, Ban } from 'lucide-react';
import { VelocityBadge } from './badges';
import type { AgencyClientSummary, VelocityAlertStatus } from './types';

export interface ClientTableProps {
  clients: AgencyClientSummary[];
  onOpenQuotaModal: (client: AgencyClientSummary) => void;
  onToggleStatus: (
    subaccountId: string,
    newStatus: 'active' | 'suspended'
  ) => Promise<void>;
  isVi: boolean;
}

export function ClientTable({
  clients,
  onOpenQuotaModal,
  onToggleStatus,
  isVi,
}: ClientTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {isVi ? 'Danh Sách Khách Hàng' : 'Client Workspaces'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isVi ? 'Kiểm soát hạn mức điểm, tốc độ tiêu hao và kích hoạt tài khoản' : 'Workspace isolation, credit quotas, and tenant statuses'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isVi ? 'Tìm kiếm khách hàng...' : 'Search clients...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-56"
            />
          </div>

          <div className="flex rounded-xl bg-muted p-0.5 border border-border/50 text-xs">
            {(['all', 'active', 'suspended'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === filterKey ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filterKey === 'all' ? (isVi ? 'Tất cả' : 'All') : filterKey === 'active' ? (isVi ? 'Hoạt động' : 'Active') : (isVi ? 'Tạm khóa' : 'Suspended')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-semibold">
              <th className="py-3 px-3">{isVi ? 'Khách Hàng' : 'Client Workspace'}</th>
              <th className="py-3 px-3">{isVi ? 'Trạng Thái' : 'Status'}</th>
              <th className="py-3 px-3">{isVi ? 'Điểm MCU (Đã dùng / Hạn mức)' : 'Quota (Used / Allocated)'}</th>
              <th className="py-3 px-3">{isVi ? 'Cảnh Báo Vận Tốc' : 'Velocity Alert'}</th>
              <th className="py-3 px-3 text-right">{isVi ? 'Thao Tác' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredClients.map((client) => {
              const alertStatus: VelocityAlertStatus =
                client.mcuUtilizationRate >= 100
                  ? 'exceeded'
                  : client.mcuUtilizationRate >= 80
                  ? 'near_limit'
                  : 'normal';

              return (
                <tr key={client.id} className="hover:bg-muted/30 transition-colors">
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
