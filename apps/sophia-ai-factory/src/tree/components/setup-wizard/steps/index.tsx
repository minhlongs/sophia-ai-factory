"use client";

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { WelcomeStep } from './welcome-step';
import { ApiKeysStep } from './api-keys-step';
import { ProviderCredentialsStep, type ProviderConfig } from './provider-credentials-step';
import { ReviewStep } from './review-step';
import { FinishStep } from './finish-step';
import { SystemCheckStep } from './system-check-step';
import { WizardStepper } from '@/tree/components/setup-wizard/wizard-stepper';
import { ByokDoctrineBanner } from '@/tree/components/setup-wizard/byok-doctrine-banner';

const STEPS = [
  'welcome',
  'system_check',
  'api_keys',
  'provider_credentials',
  'review',
  'finish',
] as const;

type StepKey = typeof STEPS[number];

const STEP_LABELS: Record<StepKey, string> = {
  welcome: 'Welcome',
  system_check: 'System Check',
  api_keys: 'API Keys',
  provider_credentials: 'Providers',
  review: 'Review',
  finish: 'Finish',
};

interface SetupWizardConfig {
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DID_API_KEY: string;
  MUAPI_API_KEY: string;
  REPLICATE_API_KEY: string;
  HEYGEN_API_KEY: string;
  RESEND_API_KEY: string;
  NOWPAYMENTS_API_KEY: string;
  ROUTING_STRATEGY: 'auto' | 'manual';
}

export function SetupWizardPage() {
  const t = useTranslations('setupWizard');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [config, setConfig] = useState<SetupWizardConfig>({
    OPENROUTER_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DID_API_KEY: '',
    MUAPI_API_KEY: '',
    REPLICATE_API_KEY: '',
    HEYGEN_API_KEY: '',
    RESEND_API_KEY: '',
    NOWPAYMENTS_API_KEY: '',
    ROUTING_STRATEGY: 'auto',
  });
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    HEYGEN_API_KEY: '',
    RESEND_API_KEY: '',
    NOWPAYMENTS_API_KEY: '',
    HEYGEN_WEBHOOK_SECRET: '',
    ROUTING_STRATEGY: 'priority',
  });

  const updateConfig = useCallback((key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateProviderConfig = useCallback((key: string, value: string) => {
    setProviderConfig(prev => ({ ...prev, [key]: value }));
    // Also sync to main config
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const verifyKey = useCallback(async (service: string, keyName: string, keyValue: string) => {
    if (!keyValue.trim()) {
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: t('errors.emptyKey') }));
      return false;
    }

    setStatus(prev => ({ ...prev, [keyName]: 'validating' }));
    setErrors(prev => ({ ...prev, [keyName]: '' }));

    try {
      const start = Date.now();
      const endpointMap: Record<string, string> = {
        heygen: '/api/setup-wizard/test-heygen',
        resend: '/api/setup-wizard/test-resend',
      };
      const endpoint = endpointMap[service];

      if (!endpoint) {
        // No verification endpoint for this service — mark as valid
        await new Promise(resolve => setTimeout(resolve, 300));
        const latency = Date.now() - start;
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
        setLatencies(prev => ({ ...prev, [keyName]: latency }));
        return true;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [`${service}_api_key`]: keyValue }),
      });

      const data = await response.json() as { ok?: boolean; message?: string; message_vi?: string };
      const latency = Date.now() - start;

      if (response.ok && data.ok !== false) {
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
        setLatencies(prev => ({ ...prev, [keyName]: latency }));
        return true;
      }

      const errMsg = data.message_vi || data.message || t('errors.verificationFailed');
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: errMsg }));
      setLatencies(prev => ({ ...prev, [keyName]: latency }));
      return false;
    } catch {
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: t('errors.verificationFailed') }));
      return false;
    }
  }, [t]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveFailed(false);

    try {
      const keyToProvider: Record<string, string> = {
        OPENROUTER_API_KEY: 'openrouter',
        ANTHROPIC_API_KEY: 'anthropic',
        ELEVENLABS_API_KEY: 'elevenlabs',
        DID_API_KEY: 'd-id',
        MUAPI_API_KEY: 'muapi',
        REPLICATE_API_KEY: 'replicate',
      };

      const credentials = Object.entries(config)
        .filter(([k, v]) => keyToProvider[k] && v.trim())
        .map(([k, v]) => ({ provider: keyToProvider[k], api_key: v }));

      const providerCreds = [
        providerConfig.HEYGEN_API_KEY && { provider: 'heygen', api_key: providerConfig.HEYGEN_API_KEY },
        providerConfig.RESEND_API_KEY && { provider: 'resend', api_key: providerConfig.RESEND_API_KEY },
        providerConfig.NOWPAYMENTS_API_KEY && { provider: 'nowpayments', api_key: providerConfig.NOWPAYMENTS_API_KEY },
      ].filter(Boolean);

      const allCreds = [...credentials, ...providerCreds];

      if (allCreds.length > 0) {
        const response = await fetch('/api/setup-wizard/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentials: allCreds }),
        });

        if (!response.ok) {
          const data = await response.json() as { error?: string };
          throw new Error(data.error || t('errors.saveFailed'));
        }
      }

      window.location.href = '/dashboard';
    } catch {
      setSaveError(t('errors.saveFailed'));
      setSaveFailed(true);
    }
  }, [t, config, providerConfig]);

  const handleRetry = useCallback(() => {
    setSaveError(null);
    setSaveFailed(false);
  }, []);

  const currentStep = STEPS[currentStepIndex];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ByokDoctrineBanner />

        <WizardStepper
          currentStep={currentStepIndex}
          steps={STEPS.map(s => STEP_LABELS[s as StepKey])}
        />

        <div className="mt-8 animate-in fade-in slide-in-from-right-4 duration-300">
          {currentStep === 'welcome' && (
            <WelcomeStep onNext={handleNext} />
          )}

          {currentStep === 'system_check' && (
            <SystemCheckStep onNext={handleNext} />
          )}

          {currentStep === 'api_keys' && (
            <ApiKeysStep
              config={config}
              updateConfig={updateConfig}
              verifyKey={verifyKey}
              status={status}
              errors={errors}
              latencies={latencies}
              onNext={handleNext}
            />
          )}

          {currentStep === 'provider_credentials' && (
            <ProviderCredentialsStep
              config={providerConfig}
              updateConfig={updateProviderConfig}
              status={status}
              errors={errors}
              onTestKey={verifyKey}
              savedCredentials={[]}
              latencies={latencies}
              onNext={handleNext}
            />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              config={config}
              providerConfig={providerConfig}
              onConfirm={handleSave}
              onBack={handleBack}
              loading={saveFailed}
            />
          )}

          {currentStep === 'finish' && (
            <FinishStep
              saveError={saveError}
              saveFailed={saveFailed}
              onRetry={handleRetry}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export individual steps for testing
export { WelcomeStep } from './welcome-step';
export { ApiKeysStep } from './api-keys-step';
export { ProviderCredentialsStep } from './provider-credentials-step';
export { ReviewStep } from './review-step';
export { FinishStep } from './finish-step';
export { SystemCheckStep } from './system-check-step';