"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { WizardStepper } from '@/tree/components/setup-wizard/wizard-stepper';
import { ArrowRight, Save, Loader2 } from 'lucide-react';
import { SystemCheckStep } from '@/tree/components/setup-wizard/steps/system-check-step';
import { ApiKeysStep } from '@/tree/components/setup-wizard/steps/api-keys-step';
import { LocalModeStep } from '@/forest/components/setup-wizard/local-mode-step';
import { FinishStep } from '@/tree/components/setup-wizard/steps/finish-step';
import { ProviderCredentialsStep, type ProviderConfig } from '@/tree/components/setup-wizard/steps/provider-credentials-step';
import type { CredentialSummary } from '@/tree/credentials/user-credentials-repo';

interface VerifyKeyResponse {
  valid?: boolean;
  ok?: boolean;
  message?: string;
}

interface SaveConfigResponse {
  success?: boolean;
  redirect?: string;
  message?: string;
}

export default function SetupWizardPage() {
  const router = useRouter();
  const t = useTranslations('setupWizard');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State — LLM / media keys (existing)
  const [config, setConfig] = useState({
    OPENROUTER_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DID_API_KEY: '',
    MUAPI_API_KEY: '',
  });

  // Form State — provider credentials (new BYOK)
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    HEYGEN_API_KEY: '',
    RESEND_API_KEY: '',
    NOWPAYMENTS_API_KEY: '',
    HEYGEN_WEBHOOK_SECRET: '',
  });

  // Saved credentials from server (display hints)
  const [savedCredentials, setSavedCredentials] = useState<CredentialSummary[]>([]);

  // Fetch existing saved credentials on mount
  useEffect(() => {
    fetch('/api/setup-wizard/list-credentials')
      .then((r) => r.json() as Promise<{ credentials?: CredentialSummary[] }>)
      .then((data) => {
        if (data.credentials) setSavedCredentials(data.credentials);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  // Validation State
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({
    OPENROUTER_API_KEY: 'idle',
    ANTHROPIC_API_KEY: 'idle',
    ELEVENLABS_API_KEY: 'idle',
    DID_API_KEY: 'idle',
    MUAPI_API_KEY: 'idle',
    HEYGEN_API_KEY: 'idle',
    RESEND_API_KEY: 'idle',
    NOWPAYMENTS_API_KEY: 'idle',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setStatus(prev => ({ ...prev, [key]: 'idle' }));
  };

  const updateProviderConfig = (key: keyof ProviderConfig, value: string) => {
    setProviderConfig(prev => ({ ...prev, [key]: value }));
    setStatus(prev => ({ ...prev, [key]: 'idle' }));
  };

  const verifyKey = async (service: string, keyName: string, keyValue: string, params?: unknown) => {
    setStatus(prev => ({ ...prev, [keyName]: 'validating' }));
    setErrors(prev => ({ ...prev, [keyName]: '' }));

    try {
      const res = await fetch('/api/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, key: keyValue, params })
      });

      const data = (await res.json()) as VerifyKeyResponse;
      const isValid = data.valid === true;

      if (isValid) {
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
      } else {
        setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
        setErrors(prev => ({ ...prev, [keyName]: data.message || 'Invalid key' }));
      }
      return isValid;
    } catch {
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: 'Verification failed' }));
      return false;
    }
  };

  const testProviderKey = async (
    provider: string,
    fieldKey: keyof ProviderConfig,
    value: string,
  ): Promise<boolean> => {
    if (!value.trim()) return false;
    setStatus(prev => ({ ...prev, [fieldKey]: 'validating' }));
    setErrors(prev => ({ ...prev, [fieldKey]: '' }));

    const endpoint = provider === 'heygen'
      ? '/api/setup-wizard/test-heygen'
      : provider === 'resend'
        ? '/api/setup-wizard/test-resend'
        : null;

    if (!endpoint) {
      // NOWPayments: no test endpoint yet — mark valid on non-empty
      setStatus(prev => ({ ...prev, [fieldKey]: value.trim() ? 'valid' : 'idle' }));
      return Boolean(value.trim());
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: value }),
      });
      const data = (await res.json()) as VerifyKeyResponse;
      const isOk = data.ok === true;
      setStatus(prev => ({ ...prev, [fieldKey]: isOk ? 'valid' : 'invalid' }));
      if (!isOk) setErrors(prev => ({ ...prev, [fieldKey]: data.message ?? 'Test failed' }));
      return isOk;
    } catch {
      setStatus(prev => ({ ...prev, [fieldKey]: 'invalid' }));
      setErrors(prev => ({ ...prev, [fieldKey]: 'Test request failed' }));
      return false;
    }
  };

  const handleNext = () => {
    // Step 2: Require at least one LLM key (OpenRouter or Anthropic)
    if (step === 2) {
      const hasInvalid = Object.values(status).some(v => v === 'invalid');
      if (hasInvalid) {
        alert(t('alerts.invalidKey'));
        return;
      }
      const hasLlmKey =
        config.OPENROUTER_API_KEY.trim().length > 0 ||
        config.ANTHROPIC_API_KEY.trim().length > 0;
      if (!hasLlmKey) {
        alert(t('alerts.missingLlm'));
        return;
      }
    }

    // Step 3 (Provider Credentials): HeyGen required; no saved hint = must enter key
    if (step === 3) {
      const heygenSaved = savedCredentials.find((c) => c.provider === 'heygen');
      const heygenEntered = providerConfig.HEYGEN_API_KEY.trim().length > 0;
      if (!heygenSaved && !heygenEntered) {
        alert(t('alerts.missingHeygen'));
        return;
      }
    }

    setStep(prev => prev + 1);
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveError(null);
    setSaveFailed(false);

    try {
      // 1. Save LLM / media provider keys (existing flow)
      const llmRes = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      const llmData = (await llmRes.json()) as SaveConfigResponse;
      if (!llmData.success) {
        setSaveError(llmData.message ?? 'Failed to save API keys.');
        setSaveFailed(true);
        return;
      }

      // 2. Save provider credentials (HeyGen, Resend, NOWPayments) — only non-empty values
      const credPayload: Record<string, string> = {};
      if (providerConfig.HEYGEN_API_KEY.trim()) {
        credPayload.heygen_api_key = providerConfig.HEYGEN_API_KEY.trim();
      }
      if (providerConfig.RESEND_API_KEY.trim()) {
        credPayload.resend_api_key = providerConfig.RESEND_API_KEY.trim();
      }
      if (providerConfig.NOWPAYMENTS_API_KEY.trim()) {
        credPayload.nowpayments_api_key = providerConfig.NOWPAYMENTS_API_KEY.trim();
      }
      if (providerConfig.HEYGEN_WEBHOOK_SECRET.trim()) {
        credPayload.heygen_webhook_secret = providerConfig.HEYGEN_WEBHOOK_SECRET.trim();
      }

      if (Object.keys(credPayload).length > 0) {
        const credRes = await fetch('/api/setup-wizard/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credPayload),
        });
        const credData = (await credRes.json()) as SaveConfigResponse;
        if (!credData.success) {
          setSaveError(credData.message ?? 'Failed to save provider credentials.');
          setSaveFailed(true);
          return;
        }
      }

      router.push(llmData.redirect || '/dashboard/settings');
    } catch {
      setSaveError("Failed to save configuration.");
      setSaveFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="setup-wizard-root" className="min-h-screen bg-muted/50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-primary px-8 py-6 text-primary-foreground text-center">
            <h1 className="text-3xl font-bold">{t('header.title')}</h1>
            <p className="mt-2 text-primary-foreground/80">{t('header.subtitle')}</p>
        </div>

        {/* Stepper */}
        <div className="px-8">
            <WizardStepper
                currentStep={step}
                steps={[
                    t('stepper.system'),
                    t('stepper.aiKeys'),
                    t('stepper.providers'),
                    t('stepper.localMode'),
                    t('stepper.finish'),
                ]}
            />
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px]">
            {step === 1 && <SystemCheckStep />}

            {step === 2 && (
              <ApiKeysStep
                config={config}
                updateConfig={updateConfig}
                verifyKey={verifyKey}
                status={status}
                errors={errors}
              />
            )}

            {step === 3 && (
              <ProviderCredentialsStep
                config={providerConfig}
                updateConfig={updateProviderConfig}
                status={status}
                errors={errors}
                onTestKey={testProviderKey}
                savedCredentials={savedCredentials}
              />
            )}

            {step === 4 && <LocalModeStep />}

            {step === 5 && <FinishStep saveError={saveError} saveFailed={saveFailed} onRetry={handleSave} />}
        </div>

        {/* Footer Actions */}
        <div className="bg-muted/50 px-8 py-6 flex justify-between items-center border-t border-border">
            {step > 1 && step < 5 && (
                <button
                    onClick={() => setStep(prev => prev - 1)}
                    className="text-muted-foreground hover:text-foreground font-medium px-4 py-2"
                >
                    {t('actions.back')}
                </button>
            )}

            {step === 1 && <div />} {/* Spacer */}

            {step < 5 ? (
                <button
                    onClick={handleNext}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ml-auto"
                >
                    {t('actions.next')} <ArrowRight className="w-4 h-4" />
                </button>
            ) : (
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 ml-auto w-full justify-center sm:w-auto"
                >
                    {loading ? (
                        <>{t('actions.saving')} <Loader2 className="w-4 h-4 animate-spin" /></>
                    ) : (
                        <>{t('actions.launch')} <Save className="w-4 h-4" /></>
                    )}
                </button>
            )}
        </div>
      </div>

      <p className="mt-8 text-muted-foreground text-sm">{t('footer')}</p>
    </div>
  );
}
