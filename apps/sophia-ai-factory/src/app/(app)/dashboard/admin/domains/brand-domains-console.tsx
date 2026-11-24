'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  BrandDomainAuditEvent,
  BrandDomainIdentity,
  BrandDomainReadinessChecks,
  TechnicalRuntimeIdentity,
} from '@/seed/domain';
import { DomainReadinessPanel } from './domain-readiness-panel';
import { TechnicalIdentityCard, AuditEventsSection } from './brand-domains-sections';
import { getCsrfHeaders } from '@/seed/security/use-csrf-token';

interface RegistryResponse {
  technicalIdentity: TechnicalRuntimeIdentity;
  staticAllowedHosts: string[];
  domains: BrandDomainIdentity[];
  auditEvents: BrandDomainAuditEvent[];
  error?: string;
}

export function BrandDomainsConsole() {
  const t = useTranslations('adminDomains');
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hostname, setHostname] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRegistry = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/domains', { cache: 'no-store' });
      const json = (await res.json()) as RegistryResponse;
      if (!res.ok) {
        setError(json.error || t('loadError'));
      } else {
        setData(json);
      }
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!hostname.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({
          hostname: hostname.trim(),
          cloudflareZoneId: zoneId.trim() || undefined,
          tenantId: tenantId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || t('loadError'));
      } else {
        setHostname('');
        setZoneId('');
        setTenantId('');
        await loadRegistry();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleCheck(
    domainId: string,
    key: keyof BrandDomainReadinessChecks,
    value: boolean,
  ) {
    setBusyId(domainId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/domains/${domainId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ action: 'update_checks', checks: { [key]: value } }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) setError(json.error || t('loadError'));
      await loadRegistry();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAction(
    domainId: string,
    action: 'verify' | 'activate' | 'suspend' | 'rollback',
  ) {
    setBusyId(domainId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/domains/${domainId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) setError(json.error || t('loadError'));
      await loadRegistry();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {data && (
        <TechnicalIdentityCard
          identity={data.technicalIdentity}
          staticAllowedHosts={data.staticAllowedHosts}
        />
      )}

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
        <p className="font-semibold">{t('externalNoticeTitle')}</p>
        <p className="mt-1">{t('externalNoticeBody')}</p>
      </section>

      <form
        onSubmit={(e) => void handleRegister(e)}
        className="rounded-xl border border-border bg-card p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-foreground">{t('registerTitle')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder={t('hostnamePlaceholder')}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono"
          />
          <input
            type="text"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            placeholder={t('zoneIdPlaceholder')}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono"
          />
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder={t('tenantIdPlaceholder')}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? t('registering') : t('registerButton')}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t('domainsTitle')}</h2>
        {!data || data.domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('emptyDomains')}</p>
        ) : (
          data.domains.map((domain) => (
            <DomainReadinessPanel
              key={domain.id}
              domain={domain}
              busy={busyId === domain.id}
              onToggleCheck={handleToggleCheck}
              onAction={handleAction}
            />
          ))
        )}
      </section>

      <AuditEventsSection events={data?.auditEvents ?? []} />
    </div>
  );
}
