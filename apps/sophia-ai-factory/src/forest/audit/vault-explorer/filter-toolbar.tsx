/**
 * Audit Vault Explorer Filter Toolbar
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/filter-toolbar
 */

// i18n-namespace: auditVault

import React from 'react';
import { Search, Filter } from 'lucide-react';

export interface FilterToolbarProps {
  t: (key: string) => string;
  selectedAction: string;
  setSelectedAction: (action: string) => void;
  actorQuery: string;
  setActorQuery: (query: string) => void;
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
  isFiltering: boolean;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

export function FilterToolbar({
  t,
  selectedAction,
  setSelectedAction,
  actorQuery,
  setActorQuery,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  isFiltering,
  onApplyFilters,
  onResetFilters,
}: FilterToolbarProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Action Filter */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            {t('filters.action')}
          </label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          >
            <option value="all">{t('filters.allActions')}</option>
            <option value="video.published">video.published</option>
            <option value="video.approved">video.approved</option>
            <option value="video.rejected">video.rejected</option>
            <option value="mcu.allocated">mcu.allocated</option>
            <option value="apikey.created">apikey.created</option>
            <option value="apikey.revoked">apikey.revoked</option>
            <option value="payout.approved">payout.approved</option>
            <option value="rbac.role_changed">rbac.role_changed</option>
            <option value="sso.configured">sso.configured</option>
            <option value="sso.deleted">sso.deleted</option>
            <option value="custom_domain.registered">
              custom_domain.registered
            </option>
            <option value="custom_domain.verified">
              custom_domain.verified
            </option>
            <option value="branding.updated">branding.updated</option>
          </select>
        </div>

        {/* Actor Query */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            {t('table.actor')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder={t('filters.searchActor')}
              value={actorQuery}
              onChange={(e) => setActorQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* From Date */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            {t('filters.from')}
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            {t('filters.to')}
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-3">
        <button
          onClick={onResetFilters}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          {t('filters.reset')}
        </button>
        <button
          onClick={onApplyFilters}
          disabled={isFiltering}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          <Filter className="h-3.5 w-3.5" />
          {isFiltering ? 'Filtering...' : t('filters.apply')}
        </button>
      </div>
    </div>
  );
}
