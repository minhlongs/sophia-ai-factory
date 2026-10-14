'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, AlertTriangle } from 'lucide-react';
import type { Approval, ApprovalQueueProps } from './types';
import { ApprovalCard } from './card';

export function ApprovalQueue({ workspaceId }: ApprovalQueueProps) {
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

      const data = (await res.json()) as {
        approvals: Array<{
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
        }>;
      };
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
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.id}
          approval={approval}
          busy={actionId === approval.id}
          actionError={actionId === approval.id ? actionError : null}
          onResolve={handleResolve}
        />
      ))}
    </div>
  );
}
