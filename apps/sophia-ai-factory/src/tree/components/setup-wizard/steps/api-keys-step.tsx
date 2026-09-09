import React from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';

interface ApiKeysStepProps {
  config: {
    OPENROUTER_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    DID_API_KEY: string;
    MUAPI_API_KEY: string;
    REPLICATE_API_KEY: string;
    FAL_API_KEY: string;
  };
  updateConfig: (key: string, value: string) => void;
  verifyKey: (service: string, keyName: string, keyValue: string) => Promise<boolean>;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  errors: Record<string, string>;
  latencies?: Record<string, number>;
  onNext: () => void;
}

export function ApiKeysStep({ config, updateConfig, verifyKey, status, errors, latencies, onNext }: ApiKeysStepProps) {
  const t = useTranslations('setupWizard.apiKeys');
  const actions = useTranslations('setupWizard.actions');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
      <p className="text-muted-foreground text-sm">{t('subtitle')}</p>

      <div className="space-y-1">
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
        />
        <ByokHelpTip provider="openrouter" />
      </div>

      <div className="space-y-1">
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
        />
        <ByokHelpTip provider="elevenlabs" />
      </div>

      <div className="space-y-1">
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
        />
        <ByokHelpTip provider="d-id" />
      </div>

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
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 transition-opacity"
        >
          {actions('next')}
        </button>
      </div>
    </div>
  );
}
