import React from 'react';
import { Search } from 'lucide-react';

// i18n-namespace: auditVault

export const AUDIT_ACTION_OPTIONS = [
  'video.published',
  'video.approved',
  'video.rejected',
  'mcu.allocated',
  'apikey.created',
  'apikey.revoked',
  'payout.approved',
  'rbac.role_changed',
  'sso.configured',
  'sso.deleted',
  'custom_domain.registered',
  'custom_domain.verified',
  'branding.updated',
] as const;

export interface FilterToolbarFieldsProps {
  t: (key: string) => string;
  selectedAction: string;
  setSelectedAction: (action: string) => void;
  actorQuery: string;
  setActorQuery: (query: string) => void;
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
}

export function FilterToolbarFields({
  t,
  selectedAction,
  setSelectedAction,
  actorQuery,
  setActorQuery,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}: FilterToolbarFieldsProps) {
  return (
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
          {AUDIT_ACTION_OPTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
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
  );
}
