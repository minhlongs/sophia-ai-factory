/**
 * Public-Publish Ledger Approval Queue View
 * Lists pending public social/video publishes held by the approval gate and
 * lets workspace owners/admins approve or reject them via /api/publish-approvals.
 * @module components/approval-queue/publish-queue-view
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { PublishApprovalCard } from './publish-approval-card';
import {
  fetchPublishApprovals,
  submitPublishApprovalDecision,
  type PublishApprovalItem,
} from './publish-queue-api';

export interface PublishLedgerApprovalQueueProps {
  workspaceId?: string;
}

export function PublishLedgerApprovalQueue({
  workspaceId,
}: PublishLedgerApprovalQueueProps): React.ReactElement {
  const t = useTranslations('approvals');
  const [items, setItems] = useState<PublishApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await fetchPublishApprovals();
      setItems(workspaceId ? rows.filter((row) => row.tenantId === workspaceId) : rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('publish.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, workspaceId]);

  useEffect(() => {
    void load();
    const fastA = setTimeout(() => void load(), 1500);
    const fastB = setTimeout(() => void load(), 4000);
    const interval = setInterval(() => void load(), 30000);
    return () => {
      clearTimeout(fastA);
      clearTimeout(fastB);
      clearInterval(interval);
    };
  }, [load]);

  const handleDecision = async (approvalId: string, approved: boolean) => {
    setActionId(approvalId);
    setActionError(null);
    setNotice(null);
    try {
      const reasonEl = document.getElementById(
        `publish-reason-${approvalId}`,
      ) as HTMLTextAreaElement | null;
      const comment = reasonEl?.value?.trim() || undefined;
      const result = await submitPublishApprovalDecision(approvalId, approved, comment);
      if (approved && result.selfApproval) {
        setNotice(t('publish.selfApprovedNotice'));
      } else {
        setNotice(approved ? t('publish.approvedNotice') : t('publish.rejectedNotice'));
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('publish.actionError'));
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="space-y-6" aria-label={t('publish.title')}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('publish.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('publish.description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-500">
              <Clock className="h-4 w-4" />
              {items.length} {t('publish.pendingCount')}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('publish.refresh')}
          </button>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <p className="font-medium">{t('publish.errorLoading')}</p>
          <p className="mt-1 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm transition-colors hover:bg-red-500/30"
          >
            {t('publish.tryAgain')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t('publish.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('publish.emptyDescription')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <PublishApprovalCard
              key={item.id}
              item={item}
              busy={actionId === item.id}
              onDecide={(id, approved) => void handleDecision(id, approved)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
