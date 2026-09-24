'use client';

/**
 * Bilingual Cryptographic Audit Vault Explorer Component
 *
 * Implements interactive audit log exploration, multi-field filtering,
 * detail modal with previous-to-current hash link inspection, and
 * on-demand cryptographic chain verification with real-time status badges.
 *
 * Layer: forest (UI component composition)
 * Allowed imports: react, lucide-react, next-intl, @/seed/*, @/tree/*, @/land/*
 *
 * @module forest/audit/audit-vault-explorer
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Hash,
  ArrowRight,
  Copy,
  Check,
  Eye,
  X,
  FileCode,
  Lock,
  Layers,
  Activity,
  User,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type {
  EnterpriseAuditEvent,
  ChainVerificationResult,
  AuditFilterOptions,
} from '@/seed/types/enterprise-audit';
import type { Result } from '@/seed/types/result';

export interface AuditVaultExplorerProps {
  orgId?: string;
  initialEvents: EnterpriseAuditEvent[];
  initialTotal: number;
  initialVerification?: ChainVerificationResult | null;
  actions?: {
    queryEvents?: (
      filters: AuditFilterOptions,
    ) => Promise<Result<{ events: EnterpriseAuditEvent[]; total: number }, { code: string; message: string }>>;
    verifyChain?: (
      orgId?: string,
    ) => Promise<Result<ChainVerificationResult, { code: string; message: string }>>;
  };
}

export function AuditVaultExplorer({
  orgId,
  initialEvents,
  initialTotal,
  initialVerification,
  actions,
}: AuditVaultExplorerProps) {
  const t = useTranslations('auditVault');

  // State
  const [events, setEvents] = useState<EnterpriseAuditEvent[]>(initialEvents);
  const [total, setTotal] = useState<number>(initialTotal);
  const [verification, setVerification] = useState<ChainVerificationResult | null>(
    initialVerification ?? null,
  );
  const [isVerifying, startVerifyTransition] = useTransition();
  const [isFiltering, startFilterTransition] = useTransition();

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [actorQuery, setActorQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const pageSize = 20;

  // Selected event for modal slide-over
  const [selectedEvent, setSelectedEvent] = useState<EnterpriseAuditEvent | null>(null);

  // Copied hash tooltip feedback
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Run chain verification
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

  // Apply filters
  const applyFilters = (newPage = 0) => {
    if (!actions?.queryEvents) return;

    startFilterTransition(async () => {
      try {
        const fromTimestamp = fromDate ? Math.floor(new Date(fromDate).getTime() / 1000) : undefined;
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

  const formatTimestamp = (ts: number) => {
    return new Date(ts * 1000).toLocaleString(undefined, {
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
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/25">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                {t('title')}
              </h1>
              <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {verification ? (
            verification.valid ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {t('verifiedBadge', { count: verification.totalEvents })}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {t('tamperBadge', { index: verification.tamperedIndex ?? 0 })}
                </span>
              </div>
            )
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/80 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
              <Activity className="h-4 w-4 text-zinc-400" />
              <span>{t('pendingBadge')}</span>
            </div>
          )}

          {/* Verification Button */}
          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? t('verifying') : t('verifyChain')}
          </button>
        </div>
      </div>

      {/* ── Verification Summary Card ─────────────────────────────────────── */}
      {verification && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('totalEvents')}</span>
            <p className="text-lg font-semibold text-zinc-100">{verification.totalEvents}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('verifiedAt')}</span>
            <p className="text-sm font-medium text-zinc-300">
              {new Date(verification.verifiedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('genesisHash')}</span>
            <p className="font-mono text-xs text-zinc-300">
              {verification.genesisHash
                ? `${verification.genesisHash.slice(0, 10)}...${verification.genesisHash.slice(-8)}`
                : 'None'}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('latestHash')}</span>
            <p className="font-mono text-xs text-zinc-300">
              {verification.latestHash
                ? `${verification.latestHash.slice(0, 10)}...${verification.latestHash.slice(-8)}`
                : 'None'}
            </p>
          </div>
        </div>
      )}

      {/* ── Filter Toolbar ─────────────────────────────────────────────────── */}
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
              <option value="custom_domain.registered">custom_domain.registered</option>
              <option value="custom_domain.verified">custom_domain.verified</option>
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
            onClick={handleResetFilters}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            {t('filters.reset')}
          </button>
          <button
            onClick={() => applyFilters(0)}
            disabled={isFiltering}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {isFiltering ? 'Filtering...' : t('filters.apply')}
          </button>
        </div>
      </div>

      {/* ── Audit Events Table ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3.5">{t('table.status')}</th>
                <th className="px-4 py-3.5">{t('table.timestamp')}</th>
                <th className="px-4 py-3.5">{t('table.action')}</th>
                <th className="px-4 py-3.5">{t('table.actor')}</th>
                <th className="px-4 py-3.5">{t('table.resource')}</th>
                <th className="px-4 py-3.5">{t('table.contentHash')}</th>
                <th className="px-4 py-3.5 text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    {t('table.empty')}
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr
                    key={evt.id}
                    className="transition-colors hover:bg-zinc-800/40 cursor-pointer"
                    onClick={() => setSelectedEvent(evt)}
                  >
                    {/* Status / Hash Chain indicator */}
                    <td className="px-4 py-3">
                      {evt.prevHash === null ? (
                        <span
                          title="Genesis Event"
                          className="inline-flex items-center rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20"
                        >
                          GENESIS
                        </span>
                      ) : (
                        <span
                          title="Chained Record"
                          className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20"
                        >
                          CHAINED
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">
                      {formatTimestamp(evt.timestamp)}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-zinc-100">{evt.action}</span>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-zinc-200">
                          {evt.actorEmail || evt.actorId}
                        </span>
                        {evt.actorEmail && (
                          <span className="font-mono text-[10px] text-zinc-500">
                            {evt.actorId}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Resource */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-300">{evt.resourceType}</span>
                        {evt.resourceId && (
                          <span className="font-mono text-[11px] text-zinc-500">
                            ({evt.resourceId.slice(0, 8)})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Content Hash */}
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span>
                          {evt.contentHash.slice(0, 8)}...{evt.contentHash.slice(-6)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(evt.contentHash);
                          }}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          {copiedHash === evt.contentHash ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Details Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                        }}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{t('table.viewDetails')}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
          <span>
            {t('pagination.showing', {
              start: total === 0 ? 0 : page * pageSize + 1,
              end: Math.min((page + 1) * pageSize, total),
              total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyFilters(page - 1)}
              disabled={page === 0}
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              {t('pagination.previous')}
            </button>
            <button
              onClick={() => applyFilters(page + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Slide-Over / Modal Detail View ─────────────────────────────────── */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {selectedEvent.action}
                  </h3>
                  <span className="font-mono text-xs text-zinc-500">
                    ID: {selectedEvent.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cryptographic Hash Chain Link Card */}
            <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <Hash className="h-4 w-4" />
                <span>{t('modal.cryptographicLink')}</span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {t('modal.prevHash')}:
                  </span>
                  <div className="mt-1 flex items-center justify-between rounded bg-zinc-900/80 px-2.5 py-1.5 font-mono text-xs text-zinc-300">
                    <span className="truncate">
                      {selectedEvent.prevHash || `(null) - ${t('modal.genesisEvent')}`}
                    </span>
                    {selectedEvent.prevHash && (
                      <button
                        onClick={() => copyToClipboard(selectedEvent.prevHash!)}
                        className="ml-2 text-zinc-500 hover:text-zinc-200"
                      >
                        {copiedHash === selectedEvent.prevHash ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-center text-indigo-400">
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>

                <div>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {t('modal.contentHash')}:
                  </span>
                  <div className="mt-1 flex items-center justify-between rounded bg-zinc-900/80 px-2.5 py-1.5 font-mono text-xs text-emerald-400">
                    <span className="truncate">{selectedEvent.contentHash}</span>
                    <button
                      onClick={() => copyToClipboard(selectedEvent.contentHash)}
                      className="ml-2 text-zinc-500 hover:text-zinc-200"
                    >
                      {copiedHash === selectedEvent.contentHash ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 italic">
                  Formula: {t('modal.hashFormula')}
                </div>
              </div>
            </div>

            {/* Event Metadata Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg bg-zinc-900/60 p-3">
                <span className="text-zinc-500">{t('modal.actor')}</span>
                <p className="mt-0.5 font-medium text-zinc-200">
                  {selectedEvent.actorEmail || selectedEvent.actorId}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 p-3">
                <span className="text-zinc-500">{t('modal.timestamp')}</span>
                <p className="mt-0.5 font-medium text-zinc-200">
                  {formatTimestamp(selectedEvent.timestamp)}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 p-3">
                <span className="text-zinc-500">{t('modal.resourceType')}</span>
                <p className="mt-0.5 font-medium text-zinc-200">
                  {selectedEvent.resourceType}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 p-3">
                <span className="text-zinc-500">{t('modal.resourceId')}</span>
                <p className="mt-0.5 font-mono font-medium text-zinc-200">
                  {selectedEvent.resourceId || 'N/A'}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 p-3">
                <span className="text-zinc-500">{t('modal.ipAddress')}</span>
                <p className="mt-0.5 font-mono font-medium text-zinc-200">
                  {selectedEvent.ipAddress || 'Internal Edge'}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 p-3">
                <span className="text-zinc-500">{t('modal.userAgent')}</span>
                <p className="mt-0.5 font-medium text-zinc-200 truncate">
                  {selectedEvent.userAgent || 'Sophia Platform Services'}
                </p>
              </div>
            </div>

            {/* Payload JSON Inspector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  {t('modal.payload')}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(selectedEvent.payload, null, 2))
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy JSON</span>
                </button>
              </div>
              <pre className="max-h-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/90 p-3.5 font-mono text-xs text-zinc-300">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
              >
                {t('modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
