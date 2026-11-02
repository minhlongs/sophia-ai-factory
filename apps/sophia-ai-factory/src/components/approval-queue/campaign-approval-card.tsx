'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { CampaignApprovalAction, CampaignApprovalItem } from './campaign-queue-api';

function formatMoney(cents: number | undefined, locale: string): string {
  if (cents === undefined) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(ms: number | null, locale: string): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

export function CampaignApprovalCard({
  item, busy, actionError, onAction,
}: {
  item: CampaignApprovalItem; busy: boolean; actionError: string | null;
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

      {scriptExcerpt && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{scriptExcerpt}…</p>}
      {payload?.disclosureText && <p className="mt-1 text-xs text-muted-foreground">{payload.disclosureText}</p>}
      {item.rejectionReason && (
        <p className="mt-2 text-sm text-destructive">
          {t('campaign.reasonLabel')}: {item.rejectionReason}
        </p>
      )}

      {(item.status === 'pending_ceo' || item.status === 'approved' || item.status === 'executed') && (
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
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(item.id, 'resume')}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                {t('campaign.resume')}
              </button>
            )}
            {(item.status === 'approved' || item.status === 'executed') && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(item.id, 'revoke')}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {t('campaign.revoke')}
              </button>
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
