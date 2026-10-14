import React from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import type { ApiKeysStepProps } from './types';

type ExtraProvidersProps = Pick<
  ApiKeysStepProps,
  | 'config'
  | 'updateConfig'
  | 'verifyKey'
  | 'status'
  | 'errors'
  | 'latencies'
  | 'savedProviders'
  | 'onRevokeProvider'
  | 'revokingProvider'
>;

export function ExtraProviders({
  config,
  updateConfig,
  verifyKey,
  status,
  errors,
  latencies,
  savedProviders = [],
  onRevokeProvider,
  revokingProvider,
}: ExtraProvidersProps) {
  const t = useTranslations('setupWizard.apiKeys');

  return (
    <>
      <ApiKeyInput
        id="anthropic"
        label={t('anthropic.label')}
        value={config.ANTHROPIC_API_KEY}
        onChange={(v) => updateConfig('ANTHROPIC_API_KEY', v)}
        onVerify={() => verifyKey('anthropic', 'ANTHROPIC_API_KEY', config.ANTHROPIC_API_KEY)}
        status={status.ANTHROPIC_API_KEY}
        errorMessage={errors.ANTHROPIC_API_KEY}
        placeholder={t('anthropic.placeholder')}
        helpText={t('anthropic.help')}
        latency={latencies?.ANTHROPIC_API_KEY}
        saved={savedProviders.includes('anthropic')}
        onRevoke={onRevokeProvider ? () => onRevokeProvider('anthropic', 'ANTHROPIC_API_KEY') : undefined}
        isRevoking={revokingProvider === 'anthropic'}
      />

      <ApiKeyInput
        id="muapi"
        label={`${t('muapi.label')}  (${t('muapi.optionalBadge')})`}
        value={config.MUAPI_API_KEY}
        onChange={(v) => updateConfig('MUAPI_API_KEY', v)}
        onVerify={() => verifyKey('muapi', 'MUAPI_API_KEY', config.MUAPI_API_KEY)}
        status={status.MUAPI_API_KEY}
        errorMessage={errors.MUAPI_API_KEY}
        placeholder={t('muapi.placeholder')}
        helpText={t('muapi.help')}
        latency={latencies?.MUAPI_API_KEY}
        saved={savedProviders.includes('muapi')}
        onRevoke={onRevokeProvider ? () => onRevokeProvider('muapi', 'MUAPI_API_KEY') : undefined}
        isRevoking={revokingProvider === 'muapi'}
      />

      <div className="mt-4">
        <ApiKeyInput
          id="replicate"
          label={`${t('replicate.label')}  (${t('replicate.optionalBadge')})`}
          value={config.REPLICATE_API_KEY}
          onChange={(v) => updateConfig('REPLICATE_API_KEY', v)}
          onVerify={() => verifyKey('replicate', 'REPLICATE_API_KEY', config.REPLICATE_API_KEY)}
          status={status.REPLICATE_API_KEY}
          errorMessage={errors.REPLICATE_API_KEY}
          placeholder={t('replicate.placeholder')}
          helpText={t('replicate.help')}
          latency={latencies?.REPLICATE_API_KEY}
          saved={savedProviders.includes('replicate')}
          onRevoke={onRevokeProvider ? () => onRevokeProvider('replicate', 'REPLICATE_API_KEY') : undefined}
          isRevoking={revokingProvider === 'replicate'}
        />
      </div>

      <div className="mt-4">
        <ApiKeyInput
          id="fal-ai"
          label={`${t('falai.label')}  (${t('falai.optionalBadge')})`}
          value={config.FAL_API_KEY}
          onChange={(v) => updateConfig('FAL_API_KEY', v)}
          onVerify={() => verifyKey('fal-ai', 'FAL_API_KEY', config.FAL_API_KEY)}
          status={status.FAL_API_KEY}
          errorMessage={errors.FAL_API_KEY}
          placeholder={t('falai.placeholder')}
          helpText={t('falai.help')}
          latency={latencies?.FAL_API_KEY}
          saved={savedProviders.includes('fal-ai')}
          onRevoke={onRevokeProvider ? () => onRevokeProvider('fal-ai', 'FAL_API_KEY') : undefined}
          isRevoking={revokingProvider === 'fal-ai'}
        />
      </div>
    </>
  );
}
