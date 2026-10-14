'use client';

/**
 * Agency Clients List & Management Table
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/client-table
 */

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { AgencyClientSummary } from './types';
import { AgencyClientTableRow } from './client-table-row';

export interface ClientTableProps {
  clients: AgencyClientSummary[];
  onOpenQuotaModal: (client: AgencyClientSummary) => void;
  onToggleStatus: (
    subaccountId: string,
    newStatus: 'active' | 'suspended',
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
            {filteredClients.map((client) => (
              <AgencyClientTableRow
                key={client.id}
                client={client}
                isVi={isVi}
                onOpenQuotaModal={onOpenQuotaModal}
                onToggleStatus={onToggleStatus}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
