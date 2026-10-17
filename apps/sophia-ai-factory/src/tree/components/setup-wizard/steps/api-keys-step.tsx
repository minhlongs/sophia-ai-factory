import React from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';
import type { ApiKeysStepProps } from './api-keys/types';
import { ExtraProviders } from './api-keys/extra-providers';

export * from './api-keys/types';

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

      <div className="space-y-1.5">
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
          onRevoke={onRevokeProvider ? () => onRevokeProvider('openrouter', 'OPENROUTER_API_KEY') : undefined}
          isRevoking={revokingProvider === 'openrouter'}
        />
        <ByokHelpTip provider="openrouter" />
      </div>

      <div className="space-y-1.5">
        <ApiKeyInput
          id="elevenlabs"
          label={`${t('elevenlabs.label')}  (${t('elevenlabs.optionalBadge')})`}
          value={config.ELEVENLABS_API_KEY}
          onChange={(v) => updateConfig('ELEVENLABS_API_KEY', v)}
          onVerify={() => verifyKey('elevenlabs', 'ELEVENLABS_API_KEY', config.ELEVENLABS_API_KEY)}
          status={status.ELEVENLABS_API_KEY}
          errorMessage={errors.ELEVENLABS_API_KEY}
          placeholder={t('elevenlabs.placeholder')}
          helpText={t('elevenlabs.help')}
          latency={latencies?.ELEVENLABS_API_KEY}
          saved={savedProviders.includes('elevenlabs')}
          onRevoke={onRevokeProvider ? () => onRevokeProvider('elevenlabs', 'ELEVENLABS_API_KEY') : undefined}
          isRevoking={revokingProvider === 'elevenlabs'}
        />
        <ByokHelpTip provider="elevenlabs" />
      </div>

      <div className="space-y-1.5">
        <ApiKeyInput
          id="did"
          label={`${t('did.label')}  (${t('did.optionalBadge')})`}
          value={config.DID_API_KEY}
          onChange={(v) => updateConfig('DID_API_KEY', v)}
          onVerify={() => verifyKey('d-id', 'DID_API_KEY', config.DID_API_KEY)}
          status={status.DID_API_KEY}
          errorMessage={errors.DID_API_KEY}
          placeholder={t('did.placeholder')}
          helpText={t('did.help')}
          latency={latencies?.DID_API_KEY}
          saved={savedProviders.includes('d-id')}
          onRevoke={onRevokeProvider ? () => onRevokeProvider('d-id', 'DID_API_KEY') : undefined}
          isRevoking={revokingProvider === 'd-id'}
        />
        <ByokHelpTip provider="d-id" />
      </div>

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
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 transition-colors"
          >
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
