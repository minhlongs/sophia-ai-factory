import React from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';
import type { ApiKeysStepProps } from './api-keys/types';
import { ExtraProviders } from './api-keys/extra-providers';

export * from './api-keys/types';

const KEY_FIELDS = [
  { id: 'openrouter', key: 'OPENROUTER_API_KEY', provider: 'openrouter', required: true },
  { id: 'elevenlabs', key: 'ELEVENLABS_API_KEY', provider: 'elevenlabs', required: false },
  { id: 'did', key: 'DID_API_KEY', provider: 'd-id', required: false },
] as const;

export function ApiKeysStep({
  config,
  updateConfig,
  verifyKey,
  status,
  errors,
  latencies,
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

      {KEY_FIELDS.map(({ id, key, provider, required }) => (
        <div key={id} className="space-y-1.5">
          <ApiKeyInput
            id={id}
            label={required ? t(`${id}.label`) : `${t(`${id}.label`)}  (${t(`${id}.optionalBadge`)})`}
            value={config[key]}
            onChange={(v) => updateConfig(key, v)}
            onVerify={() => verifyKey(provider, key, config[key])}
            status={status[key]}
            errorMessage={errors[key]}
            placeholder={t(`${id}.placeholder`)}
            required={required}
            helpText={t(`${id}.help`)}
            latency={latencies?.[key]}
            saved={savedProviders.includes(provider)}
            onRevoke={onRevokeProvider ? () => onRevokeProvider(provider, key) : undefined}
            isRevoking={revokingProvider === provider}
          />
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

      {saveError && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-sm font-medium">
          {saveError}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-border dark:border-white/[0.08]">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 transition-colors">
            Quay lại / Back
          </button>
        ) : <div />}
        <button
          type="button"
          onClick={onNext}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-lg bg-[#4338CA] dark:bg-[#6366F1] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity disabled:opacity-50 shadow-xs"
        >
          {isSaving ? 'Đang xác thực... / Validating...' : actions('next')}
        </button>
      </div>
    </div>
  );
}