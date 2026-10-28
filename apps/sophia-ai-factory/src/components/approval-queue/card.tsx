'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, Clock, User, MessageSquare, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from '@/navigation';
import type { Approval } from './types';
import { ApprovalGovernanceBadges } from './approval-governance-badges';

interface ApprovalCardProps {
  approval: Approval;
  busy: boolean;
  actionError: string | null;
  onResolve: (approvalId: string, approved: boolean) => Promise<void>;
}

export function ApprovalCard({ approval, busy, actionError, onResolve }: ApprovalCardProps) {
  const t = useTranslations('approvals');

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const remaining = approval.timeoutAt - Math.floor(Date.now() / 1000);
  const expiring = remaining > 0 && remaining < 3600;

  return (
    <div
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

            <ApprovalGovernanceBadges approval={approval} />

            <p className="text-sm leading-relaxed text-foreground">
              {approval.actionSummary}
            </p>

            {/* What the customer is deciding, in their terms — not in agent terms. */}
            <p
              data-testid="approval-decision-impact"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {t('decision.impactLabel')}:{' '}
              {approval.complianceStatus === 'blocked'
                ? t('decision.impactBlocked')
                : t('decision.impactNormal')}
              {approval.estimatedCostCents == null && (
                <span className="ml-1 text-foreground">
                  {t('decision.costUnknown')}
                </span>
              )}
            </p>

            {approval.complianceStatus === 'blocked' && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                {t('decision.blockedReason')}
              </p>
            )}

            {/* Real link to the work, only when the server gave us a reference. */}
            {approval.missionId && (
              <Link
                href={`/dashboard/missions/${approval.missionId}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                {t('decision.openArtifact')}
              </Link>
            )}

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
                    {t('fields.cost')}: ${(approval.estimatedCostCents / 100).toFixed(2)}
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
            {/* Honest capability: the server confirms the decision, it does not
                return a publish receipt, so we do not promise one. */}
            <p
              data-testid="approval-after-approve-note"
              className="text-[11px] leading-snug text-muted-foreground"
            >
              {approval.trackingPath
                ? t('decision.afterApproveWithTracking')
                : t('decision.afterApproveNoTracking')}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(approval.id, true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              title={t('actions.approveTitle')}
            >
              <Check className="h-4 w-4" />
              {t('approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(approval.id, false)}
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

        {actionError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            {actionError}
          </div>
        )}
      </div>
    </div>
  );
}
