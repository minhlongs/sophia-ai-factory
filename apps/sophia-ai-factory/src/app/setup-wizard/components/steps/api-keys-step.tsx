import React from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '../api-key-input';

interface ApiKeysStepProps {
  config: {
    OPENROUTER_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    DID_API_KEY: string;
    HEYGEN_API_KEY: string;
    MUAPI_API_KEY: string;
  };
  updateConfig: (key: string, value: string) => void;
  verifyKey: (service: string, keyName: string, keyValue: string) => Promise<boolean>;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  errors: Record<string, string>;
}

export function ApiKeysStep({ config, updateConfig, verifyKey, status, errors }: ApiKeysStepProps) {
  const t = useTranslations('setupWizard.apiKeys');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
      <p className="text-muted-foreground text-sm">{t('subtitle')}</p>

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
      />

      <ApiKeyInput
        id="elevenlabs"
        label={t('elevenlabs.label')}
        value={config.ELEVENLABS_API_KEY}
        onChange={(v) => updateConfig('ELEVENLABS_API_KEY', v)}
        onVerify={() => verifyKey('elevenlabs', 'ELEVENLABS_API_KEY', config.ELEVENLABS_API_KEY)}
        status={status.ELEVENLABS_API_KEY}
        errorMessage={errors.ELEVENLABS_API_KEY}
        placeholder={t('elevenlabs.placeholder')}
        required
        helpText={t('elevenlabs.help')}
      />

      <ApiKeyInput
        id="did"
        label={t('did.label')}
        value={config.DID_API_KEY}
        onChange={(v) => updateConfig('DID_API_KEY', v)}
        onVerify={() => verifyKey('d-id', 'DID_API_KEY', config.DID_API_KEY)}
        status={status.DID_API_KEY}
        errorMessage={errors.DID_API_KEY}
        placeholder={t('did.placeholder')}
        required
        helpText={t('did.help')}
      />

      <ApiKeyInput
        id="heygen"
        label={t('heygen.label')}
        value={config.HEYGEN_API_KEY}
        onChange={(v) => updateConfig('HEYGEN_API_KEY', v)}
        onVerify={() => verifyKey('heygen', 'HEYGEN_API_KEY', config.HEYGEN_API_KEY)}
        status={status.HEYGEN_API_KEY}
        errorMessage={errors.HEYGEN_API_KEY}
        placeholder={t('heygen.placeholder')}
        helpText={t('heygen.help')}
      />

      <ApiKeyInput
        id="muapi"
        label={t('muapi.label')}
        value={config.MUAPI_API_KEY}
        onChange={(v) => updateConfig('MUAPI_API_KEY', v)}
        onVerify={() => verifyKey('muapi', 'MUAPI_API_KEY', config.MUAPI_API_KEY)}
        status={status.MUAPI_API_KEY}
        errorMessage={errors.MUAPI_API_KEY}
        placeholder={t('muapi.placeholder')}
        helpText={t('muapi.help')}
      />
    </div>
  );
}
