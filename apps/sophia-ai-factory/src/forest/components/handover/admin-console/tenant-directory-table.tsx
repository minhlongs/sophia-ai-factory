/**
 * Admin Console Submodule: Tenant Directory Table.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/tenant-directory-table
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';
import type { StatusFilterType } from './types';
import { TenantDirectoryRow } from './tenant-directory-row';

interface TenantDirectoryTableProps {
  handovers: CustomerHandoverRecord[];
  filteredHandovers: CustomerHandoverRecord[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: StatusFilterType;
  setStatusFilter: (filter: StatusFilterType) => void;
  onSelectRecord: (record: CustomerHandoverRecord) => void;
}

export function TenantDirectoryTable({
  handovers,
  filteredHandovers,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onSelectRecord,
}: TenantDirectoryTableProps) {
  const t = useTranslations('admin.handover');

  return (
    <Card className="p-6 border-border/60 shadow-sm bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('table.title')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {filteredHandovers.length} of {handovers.length} records
          </p>
        </div>

        {/* Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('table.searchPlaceholder')}
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-background border border-border focus:ring-1 focus:ring-primary outline-none w-full sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition-colors',
                statusFilter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('table.filterAll', { count: handovers.length })}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition-colors',
                statusFilter === 'pending' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('table.filterPending', { count: handovers.filter((h) => h.acceptance_status === 'pending').length })}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('accepted')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition-colors',
                statusFilter === 'accepted' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('table.filterAccepted', { count: handovers.filter((h) => h.acceptance_status === 'accepted').length })}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/20">
            <tr>
              <th className="py-3 px-3">{t('table.agency')}</th>
              <th className="py-3 px-3">{t('table.tier')}</th>
              <th className="py-3 px-3">{t('table.status')}</th>
              <th className="py-3 px-3">{t('table.acceptance')}</th>
              <th className="py-3 px-3">{t('table.signer')}</th>
              <th className="py-3 px-3">{t('table.certHash')}</th>
              <th className="py-3 px-3 text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredHandovers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('table.noHandovers')}
                </td>
              </tr>
            ) : (
              filteredHandovers.map((record) => (
                <TenantDirectoryRow
                  key={record.id}
                  record={record}
                  onSelectRecord={onSelectRecord}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
