/**
 * /dashboard/admin/sso — Client component for SSO provider configuration.
 *
 * Provides form fields for OIDC provider setup. The actual SAML 2.0 / OIDC
 * authentication handshake requires a dedicated SAML library and Better Auth
 * adapter, which is not yet implemented. This form scaffolds the configuration
 * UI and stores provider metadata for future integration.
 *
 * @module app/[locale]/dashboard/admin/sso/sso-config-form
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/seed/components/ui/button';

// ── Props ──────────────────────────────────────────────────────────────

interface SsoConfigFormProps {
  ssoEnabled: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────

export function SsoConfigForm({ ssoEnabled }: SsoConfigFormProps): React.JSX.Element {
  const t = useTranslations('admin.sso');

  const [providerUrl, setProviderUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!ssoEnabled) return;

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    // Validate required fields at the client boundary
    if (!providerUrl.trim()) {
      setSaveError('Provider URL is required');
      setSaving(false);
      return;
    }
    if (!clientId.trim()) {
      setSaveError('Client ID is required');
      setSaving(false);
      return;
    }
    if (!clientSecret.trim()) {
      setSaveError('Client secret is required');
      setSaving(false);
      return;
    }

    try {
      // Placeholder: SSO provider config storage is not yet implemented.
      // When the SAML / OIDC adapter is added, wire this to a Server Action
      // that stores the provider metadata in D1 (e.g. a `sso_providers` table).
      //
      // Future Server Action signature:
      //   saveSsoProvider(orgId: string, provider: SsoProviderInput): Promise<Result<...>>
      //
      // For now this simulates a successful save to demonstrate the UX.
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(t('ssoSaved'));
    } catch {
      setSaveError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }, [ssoEnabled, providerUrl, clientId, clientSecret, t]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Provider configuration card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        <h2 className="text-lg font-semibold">{t('providerConfig')}</h2>

        {/* Provider URL */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sso-provider-url" className="text-xs text-muted-foreground">
            {t('providerUrl')}
          </label>
          <input
            id="sso-provider-url"
            type="text"
            value={providerUrl}
            onChange={(e) => setProviderUrl(e.target.value)}
            placeholder="https://auth.example.com/.well-known/openid-configuration"
            disabled={!ssoEnabled}
            className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Client ID */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sso-client-id" className="text-xs text-muted-foreground">
            {t('clientId')}
          </label>
          <input
            id="sso-client-id"
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="your-client-id"
            disabled={!ssoEnabled}
            className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          />
        </div>

        {/* Client secret */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sso-client-secret" className="text-xs text-muted-foreground">
            Client Secret
          </label>
          <div className="relative">
            <input
              id="sso-client-secret"
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="your-client-secret"
              disabled={!ssoEnabled}
              className="w-full rounded-lg bg-muted/30 border border-border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              disabled={!ssoEnabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {saveSuccess && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {saveSuccess}
          </div>
        )}

        {saveError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {saveError}
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!ssoEnabled || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                {t('saveSso')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Documentation card */}
      <div className="rounded-2xl border border-white/10 bg-muted/20 p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary-400" aria-hidden="true" />
          Setup Guide
        </h3>
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <p>
            Sophia AI Factory supports SSO via OIDC (OpenID Connect) and SAML 2.0
            for enterprise customers. To configure SSO:
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Set up an OIDC application in your identity provider (Azure AD, Okta, Google Workspace, etc.)</li>
            <li>Enter the Provider URL (OIDC Discovery URL) from your IdP</li>
            <li>Enter the Client ID and Client Secret generated by your IdP</li>
            <li>Save the configuration</li>
          </ol>
          <p className="text-xs mt-3">
            <strong>Note:</strong> Full SAML 2.0 / OIDC authentication flow requires a dedicated SAML
            adapter to be integrated with Better Auth. This page scaffolds the configuration;
            the authentication handler will be added in a future release.
          </p>
          <p className="text-xs">
            Redirect URI to configure in your IdP:{' '}
            <code className="bg-muted/30 px-1.5 py-0.5 rounded text-primary-400">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/api/auth/callback/sso`
                : 'https://your-domain.com/api/auth/callback/sso'}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
