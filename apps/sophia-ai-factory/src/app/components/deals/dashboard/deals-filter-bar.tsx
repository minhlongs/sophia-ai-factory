'use client';

/**
 * Deals Admin Dashboard Filter & View Controls Bar
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/deals-filter-bar
 */

import React from 'react';
import { Search, LayoutGrid, Table as TableIcon } from 'lucide-react';

export interface DealsFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  stageFilter: string;
  onStageFilterChange: (val: string) => void;
  tierFilter: string;
  onTierFilterChange: (val: string) => void;
  viewMode: 'kanban' | 'table';
  onViewModeChange: (val: 'kanban' | 'table') => void;
  isVi: boolean;
}

export function DealsFilterBar({
  search,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  tierFilter,
  onTierFilterChange,
  viewMode,
  onViewModeChange,
  isVi,
}: DealsFilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
      <div className="flex items-center gap-3 flex-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder={isVi ? 'Tìm kiếm theo tên công ty, domain, liên hệ...' : 'Search company, domain, contact...'}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={stageFilter}
            onChange={(e) => onStageFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-emerald-500 capitalize"
          >
            <option value="all">{isVi ? 'Tất cả giai đoạn' : 'All Stages'}</option>
            <option value="new_lead">New Lead</option>
            <option value="qualified">Qualified</option>
            <option value="demo_prepared">Demo Prepared</option>
            <option value="demo_active">Demo Active</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="negotiating">Negotiating</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => onTierFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-emerald-500 capitalize"
          >
            <option value="all">{isVi ? 'Tất cả mức BANT' : 'All BANT Tiers'}</option>
            <option value="hot">🔥 Hot Deals (≥75)</option>
            <option value="warm">⚡ Warm Deals (50–74)</option>
            <option value="cold">❄️ Cold Deals (&lt;50)</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              viewMode === 'kanban'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              viewMode === 'table'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Table
          </button>
        </div>
      </div>
    </div>
  );
}
