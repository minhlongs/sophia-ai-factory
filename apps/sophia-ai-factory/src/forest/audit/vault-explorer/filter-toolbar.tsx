/**
 * Audit Vault Explorer Filter Toolbar
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/filter-toolbar
 */

// i18n-namespace: auditVault

import React from 'react';
import { Filter } from 'lucide-react';
import {
  FilterToolbarFields,
  AUDIT_ACTION_OPTIONS,
  type FilterToolbarFieldsProps,
} from './filter-toolbar-fields';

export { AUDIT_ACTION_OPTIONS, FilterToolbarFields, type FilterToolbarFieldsProps };

export interface FilterToolbarProps extends FilterToolbarFieldsProps {
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
      <FilterToolbarFields
        t={t}
        selectedAction={selectedAction}
        setSelectedAction={setSelectedAction}
        actorQuery={actorQuery}
        setActorQuery={setActorQuery}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
      />

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
