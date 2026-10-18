/**
 * State and transition hook for AuditVaultExplorer.
 * @module forest/audit/vault-explorer/use-audit-vault-state
 */

'use client';

import { useState, useTransition } from 'react';
import type {
  EnterpriseAuditEvent,
  ChainVerificationResult,
  AuditVaultExplorerProps,
} from './types';
import { buildAuditFilterOptions } from './vault-explorer-helpers';

export function useAuditVaultState({
  orgId,
  initialEvents,
  initialTotal,
  initialVerification,
  actions,
}: AuditVaultExplorerProps) {
  const [events, setEvents] = useState<EnterpriseAuditEvent[]>(initialEvents);
  const [total, setTotal] = useState<number>(initialTotal);
  const [verification, setVerification] =
    useState<ChainVerificationResult | null>(initialVerification ?? null);
  const [isVerifying, startVerifyTransition] = useTransition();
  const [isFiltering, startFilterTransition] = useTransition();

  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [actorQuery, setActorQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const pageSize = 20;

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
        if (result.ok) setVerification(result.value);
      } catch {
        // Handled via UI state
      }
    });
  };

  const applyFilters = (newPage = 0) => {
    if (!actions?.queryEvents) return;
    startFilterTransition(async () => {
      try {
        const filters = buildAuditFilterOptions({
          orgId, selectedAction, actorQuery, fromDate, toDate, pageSize, newPage,
        });
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
        const result = await actions.queryEvents!({ orgId, limit: pageSize, offset: 0 });
        if (result.ok) {
          setEvents(result.value.events);
          setTotal(result.value.total);
        }
      });
    }
  };

  return {
    events, total, verification, isVerifying, isFiltering,
    selectedAction, setSelectedAction, actorQuery, setActorQuery,
    fromDate, setFromDate, toDate, setToDate, page, pageSize,
    selectedEvent, setSelectedEvent, copiedHash, copyToClipboard,
    handleVerifyChain, applyFilters, handleResetFilters,
  };
}
