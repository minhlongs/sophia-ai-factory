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

function formatMoney(cents: number | undefined, locale: string): string {
  if (cents === undefined) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(ms: number | null, locale: string): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(ms),
  );
}

export function CampaignApprovalQueue({ workspaceId }: ApprovalQueueProps) {
  const t = useTranslations('approvals');
  const [items, setItems] = useState<CampaignApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
      setActionError(err instanceof Error ? err.message : String(err));
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
            actionError={actionId === item.id ? actionError : null}
            onAction={handleAction}
          />
        ))}
    </section>
  );
}

function CampaignApprovalCard({
  item,
  busy,
  actionError,
  onAction,
}: {
  item: CampaignApprovalItem;
  busy: boolean;
  actionError: string | null;
  onAction: (approvalId: string, action: CampaignApprovalAction) => void;
}) {
  const t = useTranslations('approvals');
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const payload = item.payload;
  const scriptExcerpt = payload?.scriptBody ? payload.scriptBody.slice(0, 220) : null;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">
          {item.campaignId}
          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {t(`campaign.status.${item.status}`)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {t('campaign.expires')}: {formatDate(item.expiresAt, locale)}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t('campaign.fields.niche')}</dt>
          <dd className="text-foreground">{item.niche ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('campaign.fields.jurisdiction')}</dt>
          <dd className="text-foreground">{item.jurisdiction ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('campaign.fields.budget')}</dt>
          <dd className="text-foreground">{formatMoney(payload?.maxRenderCostCents, locale)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('campaign.fields.target')}</dt>
          <dd className="break-all text-foreground">{payload?.affiliateTargetUrl ?? '—'}</dd>
        </div>
      </dl>

      {scriptExcerpt && (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{scriptExcerpt}…</p>
      )}
      {payload?.disclosureText && (
        <p className="mt-1 text-xs text-muted-foreground">{payload.disclosureText}</p>
      )}

      {item.rejectionReason && (
        <p className="mt-2 text-sm text-destructive">
          {t('campaign.reasonLabel')}: {item.rejectionReason}
        </p>
      )}

      {(item.status === 'pending_ceo' || item.status === 'approved') && (
        <div className="mt-3 space-y-2">
          <textarea
            id={`campaign-reason-${item.id}`}
            rows={2}
            placeholder={t('reasonPlaceholder')}
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
          />
          <div className="flex flex-wrap gap-2">
            {item.status === 'pending_ceo' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction(item.id, 'approve')}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                >
                  {t('approve')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction(item.id, 'reject')}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  {t('reject')}
                </button>
              </>
            )}
            {item.status === 'approved' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction(item.id, 'resume')}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                >
                  {t('campaign.resume')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction(item.id, 'revoke')}
                  className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {t('campaign.revoke')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        {t('campaign.hashLabel')}: {item.approvalPayloadHash.slice(0, 16)}…
      </p>
    </article>
  );
}
