import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { ValidationReceiptCard } from '@/tree/components/setup-wizard/validation-receipt-card';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';
import type { ApiKeysStepProps } from './api-keys/types';
import { ExtraProviders } from './api-keys/extra-providers';

export * from './api-keys/types';

const OPTIONAL_VOICE_AVATAR_FIELDS = [
  { id: 'elevenlabs', key: 'ELEVENLABS_API_KEY', provider: 'elevenlabs' },
  { id: 'did', key: 'DID_API_KEY', provider: 'd-id' },
] as const;

export function ApiKeysStep({
  config,
  updateConfig,
  verifyKey,
  status,
  errors,
  latencies,
  receipts,
  savedProviders = [],
  onRevokeProvider,
  revokingProvider,
  saveError,
  isSaving,
  onNext,
  onBack,
}: ApiKeysStepProps) {
  const t = useTranslations('setupWizard.apiKeys');
  const actions = useTranslations('setupWizard.actions');

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
      </div>

      <section
        data-testid="fast-track-byok-card"
        className="rounded-xl border border-border bg-primary/10 p-4 space-y-3"
      >
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {t('fastTrack.badge')}
          </span>
          <h3 className="text-sm sm:text-base font-semibold text-foreground">
            {t('fastTrack.title')}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {t('fastTrack.description')}
          </p>
        </div>

        <div className="space-y-2">
          <ApiKeyInput
            id="openrouter"
            label={t('openrouter.label')}
            value={config.OPENROUTER_API_KEY}
            onChange={(v) => updateConfig('OPENROUTER_API_KEY', v)}
            onVerify={() => verifyKey('openrouter', 'OPENROUTER_API_KEY', config.OPENROUTER_API_KEY)}
            status={status.OPENROUTER_API_KEY}
            errorMessage={errors.OPENROUTER_API_KEY}
            placeholder={t('openrouter.placeholder')}
            required
            helpText={t('openrouter.help')}
            latency={latencies?.OPENROUTER_API_KEY}
            saved={savedProviders.includes('openrouter')}
            onRevoke={
              onRevokeProvider ? () => onRevokeProvider('openrouter', 'OPENROUTER_API_KEY') : undefined
            }
            isRevoking={revokingProvider === 'openrouter'}
          />
          {receipts?.OPENROUTER_API_KEY && (
            <ValidationReceiptCard
              receipt={receipts.OPENROUTER_API_KEY}
              latencyMs={latencies?.OPENROUTER_API_KEY}
            />
          )}
          <ByokHelpTip provider="openrouter" />
        </div>
      </section>

      <section className="space-y-4 pt-2 border-t border-border">
        <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('fastTrack.optionalSectionTitle')}
        </h3>

        {OPTIONAL_VOICE_AVATAR_FIELDS.map(({ id, key, provider }) => (
          <div key={id} className="space-y-1.5">
            <ApiKeyInput
              id={id}
              label={`${t(`${id}.label`)}  (${t(`${id}.optionalBadge`)})`}
              value={config[key]}
              onChange={(v) => updateConfig(key, v)}
              onVerify={() => verifyKey(provider, key, config[key])}
              status={status[key]}
              errorMessage={errors[key]}
              placeholder={t(`${id}.placeholder`)}
              required={false}
              helpText={t(`${id}.help`)}
              latency={latencies?.[key]}
              saved={savedProviders.includes(provider)}
              onRevoke={onRevokeProvider ? () => onRevokeProvider(provider, key) : undefined}
              isRevoking={revokingProvider === provider}
            />
            {receipts?.[key] && (
              <ValidationReceiptCard receipt={receipts[key]} latencyMs={latencies?.[key]} />
            )}
            <ByokHelpTip provider={provider} />
          </div>
        ))}

        <ExtraProviders
          config={config}
          updateConfig={updateConfig}
          verifyKey={verifyKey}
          status={status}
          errors={errors}
          latencies={latencies}
          savedProviders={savedProviders}
          onRevokeProvider={onRevokeProvider}
          revokingProvider={revokingProvider}
        />
      </section>

      {saveError && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-sm font-medium">
          {saveError}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-border">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 transition-colors"
          >
            Quay lại / Back
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity disabled:opacity-50 shadow-xs"
        >
          {isSaving ? 'Đang xác thực... / Validating...' : actions('next')}
        </button>
      </div>
    </div>
  );
}
