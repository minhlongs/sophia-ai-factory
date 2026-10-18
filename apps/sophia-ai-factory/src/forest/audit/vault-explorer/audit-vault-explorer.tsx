/**
 * Audit Vault Explorer Main Client Component
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/audit-vault-explorer
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { HeaderBanner } from './header-banner';
import { FilterToolbar } from './filter-toolbar';
import { EventsTable } from './events-table';
import { DetailModal } from './detail-modal';
import type { AuditVaultExplorerProps } from './types';
import { formatAuditEventTimestamp } from './vault-explorer-helpers';
import { useAuditVaultState } from './use-audit-vault-state';

export function AuditVaultExplorer(props: AuditVaultExplorerProps) {
  const t = useTranslations('auditVault');
  const {
    events,
    total,
    verification,
    isVerifying,
    isFiltering,
    selectedAction,
    setSelectedAction,
    actorQuery,
    setActorQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    page,
    pageSize,
    selectedEvent,
    setSelectedEvent,
    copiedHash,
    copyToClipboard,
    handleVerifyChain,
    applyFilters,
    handleResetFilters,
  } = useAuditVaultState(props);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <HeaderBanner t={t} verification={verification} isVerifying={isVerifying} onVerifyChain={handleVerifyChain} />
      <FilterToolbar
        t={t} selectedAction={selectedAction} setSelectedAction={setSelectedAction}
        actorQuery={actorQuery} setActorQuery={setActorQuery} fromDate={fromDate}
        setFromDate={setFromDate} toDate={toDate} setToDate={setToDate}
        isFiltering={isFiltering} onApplyFilters={() => applyFilters(0)} onResetFilters={handleResetFilters}
      />
      <EventsTable
        t={t} events={events} total={total} page={page} pageSize={pageSize}
        copiedHash={copiedHash} onCopyHash={copyToClipboard} onSelectEvent={setSelectedEvent}
        onPageChange={(p) => applyFilters(p)} formatTimestamp={formatAuditEventTimestamp}
      />
      <DetailModal
        t={t} selectedEvent={selectedEvent} copiedHash={copiedHash}
        onClose={() => setSelectedEvent(null)} onCopyText={copyToClipboard} formatTimestamp={formatAuditEventTimestamp}
      />
    </div>
  );
}
