'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import type { ApprovalQueueProps } from './types';
import {
  fetchCampaignApprovals,
  submitCampaignApprovalAction,
  type CampaignApprovalAction,
  type CampaignApprovalItem,
} from './campaign-queue-api';
import { CampaignApprovalCard } from './campaign-approval-card';
import type { WorkflowConvergenceView } from '@/tree/mission/workflow-convergence-enricher';
import { ConvergenceOutcomeStrip } from '../workflow-anatomy/convergence-outcome-strip';

export function CampaignApprovalQueue({
  workspaceId,
  convergence,
}: ApprovalQueueProps & { convergence?: WorkflowConvergenceView }) {
  const t = useTranslations('approvals');
  const [items, setItems] = useState<CampaignApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchCampaignApprovals(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const handleAction = async (approvalId: string, action: CampaignApprovalAction) => {
    setActionId(approvalId);
    setActionError(null);
    setNotice(null);
    const reasonInput = document.getElementById(
      `campaign-reason-${approvalId}`,
    ) as HTMLTextAreaElement | null;
    const reason = reasonInput?.value?.trim() || undefined;
    try {
      const result = await submitCampaignApprovalAction(approvalId, action, reason);
      if (result.continuation === 'not_sent') {
        setNotice(t('campaign.continuationPending'));
      } else if (result.resumed) {
        setNotice(t('campaign.resumed'));
      }
      await load();
    } catch (err) {
      setActionError({ id: approvalId, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionId(null);
    }
  };

  return (
    <section aria-label={t('campaign.title')} className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t('campaign.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('campaign.description')}</p>

      {convergence && <ConvergenceOutcomeStrip convergence={convergence} />}

      {notice && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-sm">{t('campaign.loading')}</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {t('campaign.loadFailed')}
          </div>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs hover:bg-destructive/10"
          >
            {t('campaign.retry')}
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-base font-semibold text-foreground">{t('campaign.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('campaign.emptyDescription')}</p>
        </div>
      )}

      {!loading &&
        !error &&
        items.map((item) => (
          <CampaignApprovalCard
            key={item.id}
            item={item}
            busy={actionId === item.id}
            actionError={actionError?.id === item.id ? actionError.message : null}
            onAction={handleAction}
          />
        ))}
    </section>
  );
}
