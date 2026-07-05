/**
 * /dashboard/admin/sso — SSO configuration page (MASTER-tier only).
 *
 * Server Component. Shows SSO feature status and provides a configuration form
 * for enterprise SSO providers (OIDC/SAML). The form stores provider metadata
 * for use in authentication flows.
 *
 * Note: Full SAML 2.0 handshake requires a dedicated SAML library. This page
 * scaffolds the configuration UI and stores provider settings. The actual
 * SAML/OIDC authentication flow is delegated to Better Auth's social OAuth
 * providers and can be extended with a SAML adapter.
 *
 * @module app/[locale]/dashboard/admin/sso/page
 */

import { Fingerprint } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { masterHasFeature } from '@/land/enterprise-features';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { SsoConfigForm } from './sso-config-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SsoPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await requireMasterTier();
  const t = await getTranslations({ locale, namespace: 'admin.sso' });

  const tier = await resolveUserTier(user.id);
  const ssoEnabled = masterHasFeature(tier, 'enable_enterprise_sso');

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Fingerprint className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('pageSubtitle')}
          </p>
        </div>
      </header>

      {/* SSO status banner */}
      <div
        className={`rounded-2xl border p-4 flex items-center gap-3 ${
          ssoEnabled
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            ssoEnabled ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium">
            {t('status')}: {ssoEnabled ? t('enabled') : t('disabled')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ssoEnabled
              ? 'Enterprise SSO feature flag is active. Configure providers below.'
              : 'SSO requires the MASTER (enterprise) tier. Upgrade to enable SAML 2.0 / OIDC.'}
          </p>
        </div>
      </div>

      {/* SSO configuration form */}
      <SsoConfigForm ssoEnabled={ssoEnabled} />
    </div>
  );
}
