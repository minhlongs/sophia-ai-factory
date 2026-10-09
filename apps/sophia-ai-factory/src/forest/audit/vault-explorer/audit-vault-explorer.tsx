/**
 * Audit Vault Explorer Main Client Component
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/audit-vault-explorer
 */

'use client';

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { HeaderBanner } from './header-banner';
import { FilterToolbar } from './filter-toolbar';
import { EventsTable } from './events-table';
import { DetailModal } from './detail-modal';
import type {
  EnterpriseAuditEvent,
  ChainVerificationResult,
  AuditFilterOptions,
  AuditVaultExplorerProps,
} from './types';

export function AuditVaultExplorer({
  orgId,
  initialEvents,
  initialTotal,
  initialVerification,
  actions,
}: AuditVaultExplorerProps) {
  const t = useTranslations('auditVault');

  // Core state
  const [events, setEvents] = useState<EnterpriseAuditEvent[]>(initialEvents);
  const [total, setTotal] = useState<number>(initialTotal);
  const [verification, setVerification] =
    useState<ChainVerificationResult | null>(initialVerification ?? null);
  const [isVerifying, startVerifyTransition] = useTransition();
  const [isFiltering, startFilterTransition] = useTransition();

  // Filters state
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [actorQuery, setActorQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const pageSize = 20;

  // Selected event & copy state
  const [selectedEvent, setSelectedEvent] =
    useState<EnterpriseAuditEvent | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerifyChain = () => {
    if (!actions?.verifyChain) return;

    startVerifyTransition(async () => {
      try {
        const result = await actions.verifyChain!(orgId);
        if (result.ok) {
          setVerification(result.value);
        }
      } catch {
        // Handled via UI state
      }
    });
  };

  const applyFilters = (newPage = 0) => {
    if (!actions?.queryEvents) return;

    startFilterTransition(async () => {
      try {
        const fromTimestamp = fromDate
          ? Math.floor(new Date(fromDate).getTime() / 1000)
          : undefined;
        const toTimestamp = toDate
          ? Math.floor(new Date(toDate).setHours(23, 59, 59, 999) / 1000)
          : undefined;

        const filters: AuditFilterOptions = {
          orgId,
          action: selectedAction !== 'all' ? selectedAction : undefined,
          actorEmail: actorQuery ? actorQuery.trim() : undefined,
          fromTimestamp,
          toTimestamp,
          limit: pageSize,
          offset: newPage * pageSize,
        };

        const result = await actions.queryEvents!(filters);
        if (result.ok) {
          setEvents(result.value.events);
          setTotal(result.value.total);
          setPage(newPage);
        }
      } catch {
        // Keep current state
      }
    });
  };

  const handleResetFilters = () => {
    setSelectedAction('all');
    setActorQuery('');
    setFromDate('');
    setToDate('');
    setPage(0);

    if (actions?.queryEvents) {
      startFilterTransition(async () => {
        const result = await actions.queryEvents!({
          orgId,
          limit: pageSize,
          offset: 0,
        });
        if (result.ok) {
          setEvents(result.value.events);
          setTotal(result.value.total);
        }
      });
    }
  };

  const formatTimestamp = (ts: string | number) => {
    const epochSec =
      typeof ts === 'string'
        ? Math.floor(new Date(ts).getTime() / 1000)
        : ts;
    return new Date(epochSec * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <HeaderBanner
        t={t}
        verification={verification}
        isVerifying={isVerifying}
        onVerifyChain={handleVerifyChain}
      />

      <FilterToolbar
        t={t}
        selectedAction={selectedAction}
        setSelectedAction={setSelectedAction}
        actorQuery={actorQuery}
        setActorQuery={setActorQuery}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        isFiltering={isFiltering}
        onApplyFilters={() => applyFilters(0)}
        onResetFilters={handleResetFilters}
      />

      <EventsTable
        t={t}
        events={events}
        total={total}
        page={page}
        pageSize={pageSize}
        copiedHash={copiedHash}
        onCopyHash={copyToClipboard}
        onSelectEvent={setSelectedEvent}
        onPageChange={(p) => applyFilters(p)}
        formatTimestamp={formatTimestamp}
      />

      <DetailModal
        t={t}
        selectedEvent={selectedEvent}
        copiedHash={copiedHash}
        onClose={() => setSelectedEvent(null)}
        onCopyText={copyToClipboard}
        formatTimestamp={formatTimestamp}
      />
    </div>
  );
}
