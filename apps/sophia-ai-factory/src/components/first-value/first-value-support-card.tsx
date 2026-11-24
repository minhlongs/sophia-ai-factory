'use client';

/**
 * Operational in-app Support & Data Deletion request card for the Private Beta.
 *
 * Provides a real durable request path stored in `sophia-pilot-db` (`pilot_support_requests`)
 * and acknowledged with a receipt ID (`psr_<uuid>`) and 72-hour operator SLA.
 *
 * @module components/first-value/first-value-support-card
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { PilotSupportRequestSummary } from '@/seed/pilot/pilot-access-policy';

export type SupportRequestKind = 'support' | 'data_deletion';

export interface SupportSubmissionReceipt {
  readonly requestId: string;
  readonly requestType: SupportRequestKind;
  readonly status: string;
  readonly submittedAtIso: string;
  readonly slaHours: number;
}

export interface FirstValueSupportCardProps {
  readonly busy: boolean;
  readonly requests: readonly PilotSupportRequestSummary[];
  readonly onSubmitRequest: (input: {
    readonly requestType: SupportRequestKind;
    readonly subject: string;
    readonly details: string;
  }) => Promise<SupportSubmissionReceipt | null>;
}

export function FirstValueSupportCard({
  busy,
  requests,
  onSubmitRequest,
}: FirstValueSupportCardProps) {
  const t = useTranslations('firstValue');
  const [requestType, setRequestType] = useState<SupportRequestKind>('support');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [lastReceipt, setLastReceipt] = useState<SupportSubmissionReceipt | null>(null);

  const canSubmit = subject.trim().length >= 3 && details.trim().length >= 5;

  async function handleSubmit() {
    if (!canSubmit) return;
    const receipt = await onSubmitRequest({
      requestType,
      subject: subject.trim(),
      details: details.trim(),
    });
    if (receipt) {
      setLastReceipt(receipt);
      setSubject('');
      setDetails('');
    }
  }

  return (
    <section id="support-deletion" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t('supportTitle')}</h2>
        <Link
          href="/privacy"
          className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
        >
          {t('privacyNoticeLink')}
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t('supportSubtitle')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('supportTypeLabel')}
          <select
            value={requestType}
            disabled={busy}
            onChange={(e) => setRequestType(e.target.value as SupportRequestKind)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="support">{t('supportTypeGeneral')}</option>
            <option value="data_deletion">{t('supportTypeDeletion')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('supportSubjectLabel')}
          <input
            type="text"
            maxLength={200}
            value={subject}
            disabled={busy}
            placeholder={t('supportSubjectPlaceholder')}
            onChange={(e) => {
              setSubject(e.target.value);
              if (lastReceipt) setLastReceipt(null);
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
        {t('supportDetailsLabel')}
        <textarea
          rows={3}
          maxLength={2000}
          value={details}
          disabled={busy}
          placeholder={t('supportDetailsPlaceholder')}
          onChange={(e) => {
            setDetails(e.target.value);
            if (lastReceipt) setLastReceipt(null);
          }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('loading') : t('supportSubmitBtn')}
        </button>
        {lastReceipt && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t('supportAckPrefix')} <code className="font-mono">{lastReceipt.requestId}</code> (
            {lastReceipt.slaHours}h SLA)
          </span>
        )}
      </div>

      {requests.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-semibold text-foreground">{t('supportHistoryTitle')}</h3>
          <ul className="flex flex-col gap-1.5 text-xs">
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5"
              >
                <span className="text-foreground">
                  <code className="mr-2 font-mono text-primary">{req.id}</code>
                  {req.subject}
                </span>
                <span className="font-mono text-muted-foreground">
                  {req.requestType} · {req.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
