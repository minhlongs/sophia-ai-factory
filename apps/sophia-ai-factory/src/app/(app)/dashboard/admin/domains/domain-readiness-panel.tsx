'use client';

import type {
  BrandDomainIdentity,
  BrandDomainReadinessChecks,
} from '@/seed/domain';
import { useTranslations } from 'next-intl';

const CHECK_KEYS: readonly (keyof BrandDomainReadinessChecks)[] = [
  'ownershipVerified',
  'cfZoneEligible',
  'workerAttached',
  'tlsVerified',
  'authOriginVerified',
  'accessPolicyVerified',
  'tenantAuthVerified',
  'noPublicBypassVerified',
  'externalCallbacksReviewed',
  'smokeVerified',
];

const STATUS_BADGE_CLASSES: Record<BrandDomainIdentity['status'], string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  VERIFIED: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  SUSPENDED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

interface DomainReadinessPanelProps {
  readonly domain: BrandDomainIdentity;
  readonly busy: boolean;
  readonly onToggleCheck: (
    domainId: string,
    key: keyof BrandDomainReadinessChecks,
    value: boolean,
  ) => Promise<void>;
  readonly onAction: (
    domainId: string,
    action: 'verify' | 'activate' | 'suspend' | 'rollback',
  ) => Promise<void>;
}

export function DomainReadinessPanel({
  domain,
  busy,
  onToggleCheck,
  onAction,
}: DomainReadinessPanelProps) {
  const t = useTranslations('adminDomains');
  const passed = CHECK_KEYS.filter((k) => domain.checks[k]).length;
  const allPassed = passed === CHECK_KEYS.length;
  const canVerify =
    domain.checks.ownershipVerified && domain.checks.cfZoneEligible;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-mono text-base font-semibold text-foreground">
              {domain.hostname}
            </h3>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[domain.status]}`}
            >
              {domain.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('workerLabel')}: <span className="font-mono">{domain.workerName}</span>
            {domain.cloudflareZoneId ? ` · Zone: ${domain.cloudflareZoneId}` : ''}
            {domain.tenantId ? ` · Tenant: ${domain.tenantId}` : ''}
          </p>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          {t('gatesProgress')}: <span className="font-mono text-foreground">{passed}/10</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CHECK_KEYS.map((key) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-foreground cursor-pointer hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={domain.checks[key]}
              disabled={busy}
              onChange={(e) => {
                void onToggleCheck(domain.id, key, e.target.checked);
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>{t(`checks.${key}`)}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !canVerify || domain.status === 'VERIFIED' || domain.status === 'ACTIVE'}
          onClick={() => void onAction(domain.id, 'verify')}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          {t('verifyButton')}
        </button>
        <button
          type="button"
          disabled={busy || !allPassed || domain.status === 'ACTIVE'}
          onClick={() => void onAction(domain.id, 'activate')}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {t('activateButton')}
        </button>
        <button
          type="button"
          disabled={busy || domain.status === 'SUSPENDED'}
          onClick={() => void onAction(domain.id, 'suspend')}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          {t('suspendButton')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAction(domain.id, 'rollback')}
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
        >
          {t('rollbackButton')}
        </button>
      </div>
    </div>
  );
}
