'use client';

import { useTranslations } from 'next-intl';
import type { BrandDomainAuditEvent, TechnicalRuntimeIdentity } from '@/seed/domain';

export function TechnicalIdentityCard({
  identity,
  staticAllowedHosts,
}: {
  identity: TechnicalRuntimeIdentity;
  staticAllowedHosts: string[];
}) {
  const t = useTranslations('adminDomains');
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{t('technicalCardTitle')}</h2>
      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t('workerLabel')}</dt>
          <dd className="mt-0.5 font-mono text-foreground">{identity.workerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('technicalUrlLabel')}</dt>
          <dd className="mt-0.5 font-mono text-primary break-all">{identity.technicalOrigin}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('shaLabel')}</dt>
          <dd className="mt-0.5 font-mono text-foreground">{identity.deploymentSha ?? 'local'}</dd>
        </div>
      </dl>
      <div className="text-xs">
        <span className="text-muted-foreground">{t('staticHostsLabel')}: </span>
        <span className="font-mono text-foreground">{staticAllowedHosts.join(', ')}</span>
      </div>
    </section>
  );
}

export function AuditEventsSection({ events }: { events: BrandDomainAuditEvent[] }) {
  const t = useTranslations('adminDomains');
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{t('auditTitle')}</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('emptyAudit')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Hostname</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="py-2 pr-3 text-muted-foreground">{ev.createdAt}</td>
                  <td className="py-2 pr-3 text-foreground">{ev.hostname}</td>
                  <td className="py-2 pr-3 text-primary">{ev.action}</td>
                  <td className="py-2 text-muted-foreground">{ev.actorEmail || ev.actorId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
