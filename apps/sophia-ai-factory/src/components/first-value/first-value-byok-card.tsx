'use client';

/**
 * BYOK status & honest validation receipt card for the First-Value Journey (Track B1.1).
 *
 * @module components/first-value/first-value-byok-card
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { HonestValidationReceipt } from '@/tree/byok/honest-validation-receipt';

export interface FirstValueByokCardProps {
  readonly byokConfigured: boolean;
  readonly receipt: HonestValidationReceipt | null;
}

export function FirstValueByokCard({ byokConfigured, receipt }: FirstValueByokCardProps) {
  const t = useTranslations('firstValue');

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-base font-semibold text-foreground">{t('byokTitle')}</h2>
      {byokConfigured && receipt ? (
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t('receiptProvider')}</dt>
            <dd className="font-mono font-semibold text-foreground">{receipt.provider}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('receiptAuthStatus')}</dt>
            <dd className="font-mono font-semibold text-foreground">
              {receipt.providerAuthStatus}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('receiptPaidInference')}</dt>
            <dd className="font-mono font-semibold text-foreground">false</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('receiptId')}</dt>
            <dd className="truncate font-mono text-foreground">{receipt.receiptId}</dd>
          </div>
        </dl>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="font-semibold text-foreground">{t('byokUnavailable')}</div>
          <p className="text-muted-foreground">{t('byokUnavailableDesc')}</p>
          <Link
            href="/dashboard/setup"
            className="w-fit rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            {t('openSetupWizard')}
          </Link>
        </div>
      )}
    </section>
  );
}
