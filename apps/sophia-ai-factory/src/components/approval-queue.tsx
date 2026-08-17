'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, Clock, User, MessageSquare, AlertTriangle } from 'lucide-react';

type Approval = {
  id: string;
  agentId: string;
  actionId: string;
  actionType: string;
  actionSummary: string;
  estimatedCostCents?: number | null;
  status: string;
  createdAt: number;
  timeoutAt: number;
  missionId?: string | null;
  workspaceId?: string;
};

export function ApprovalQueue({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('approvals');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspaceId, limit: '50', offset: '0' });
      const res = await fetch(`/api/approvals?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((body.error as string) || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { approvals: Array<{ id: string; agentId: string; actionId: string; actionType: string; actionSummary: string; estimatedCostCents?: number | null; status: string; createdAt: number; timeoutAt: number; missionId?: string | null; workspaceId?: string }> };
      const mapped: Approval[] = data.approvals.map((a) => ({
        ...a,
        workspaceId: a.workspaceId ?? workspaceId,
      }));

      setApprovals(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadApprovals();
    const timer = setInterval(loadApprovals, 30000);
    return () => clearInterval(timer);
  }, [loadApprovals]);

  const handleResolve = async (approvalId: string, approved: boolean) => {
    setActionId(approvalId);
    setActionError(null);

    const reasonInput = document.getElementById(
      `reason-${approvalId}`
    ) as HTMLTextAreaElement | null;
    const reason = reasonInput?.value?.trim() || undefined;

    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved, reason }),
      });

      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error((body.error as string) || (body.details as string) || `HTTP ${res.status}`);
      }

      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const isExpiring = (ts: number) => {
    const remaining = ts - Math.floor(Date.now() / 1000);
    return remaining > 0 && remaining < 3600;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-3 text-sm">{t('emptyDescription')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {t('actions.rejectSuccess')}
        </div>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={loadApprovals}
          className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs hover:bg-destructive/10"
        >
          {t('emptyTitle')}
        </button>
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">{t('emptyTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approvals.map((approval) => {
        const busy = actionId === approval.id;
        const expiring = isExpiring(approval.timeoutAt);

        return (
          <div
            key={approval.id}
            className={`rounded-lg border bg-card shadow-sm transition ${
              expiring ? 'border-destructive/60' : 'border-border'
            }`}
          >
            <div className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {approval.actionType}
                    </span>
                    {expiring && (
                      <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {t('fields.expires')}: soon
                      </span>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-foreground">
                    {approval.actionSummary}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span>{t('fields.agentId')}: {approval.agentId}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{t('fields.created')}: {formatDate(approval.createdAt)}</span>
                    </div>
                    {approval.estimatedCostCents != null && (
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />
                        <span>
                          {t('fields.cost')}: {(approval.estimatedCostCents / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{t('fields.expires')}: {formatDate(approval.timeoutAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:w-48">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleResolve(approval.id, true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                    title={t('actions.approveTitle')}
                  >
                    <Check className="h-4 w-4" />
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleResolve(approval.id, false)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    title={t('actions.rejectTitle')}
                  >
                    <X className="h-4 w-4" />
                    {t('reject')}
                  </button>
                  <textarea
                    id={`reason-${approval.id}`}
                    placeholder={t('reasonPlaceholder')}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={2}
                  />
                </div>
              </div>

              {actionError && actionId === approval.id && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  {actionError}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}