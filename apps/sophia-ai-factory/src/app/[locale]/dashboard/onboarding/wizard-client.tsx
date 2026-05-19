"use client";

/**
 * Onboarding Wizard — BYOK (Bring Your Own Keys) configuration client.
 * Canonical URL: /dashboard/onboarding
 *
 * Handles 5-step API key setup: System Check → AI Keys → Provider Credentials
 * → Local Mode → Finish. Persists step number (not keys) to localStorage.
 *
 * Formerly lived at /[locale]/setup-wizard/page.tsx. Consolidated here per
 * plan 260519-0300-handover-funnel-critical-fixes/phase-02.
 *
 * @module app/[locale]/dashboard/onboarding/wizard-client
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { WizardStepper } from '@/tree/components/setup-wizard/wizard-stepper';
import { ArrowRight, Save, Loader2, AlertTriangle } from 'lucide-react';
import { SystemCheckStep } from '@/tree/components/setup-wizard/steps/system-check-step';
import { ApiKeysStep } from '@/tree/components/setup-wizard/steps/api-keys-step';
import { LocalModeStep } from '@/forest/components/setup-wizard/local-mode-step';
import { FinishStep } from '@/tree/components/setup-wizard/steps/finish-step';
import { ProviderCredentialsStep, type ProviderConfig } from '@/tree/components/setup-wizard/steps/provider-credentials-step';
import type { CredentialSummary } from '@/tree/credentials/user-credentials-repo';

/** Unified response type: supports both valid (verify) and ok (test-heygen/resend) */
interface VerifyKeyResponse {
  valid?: boolean;
  ok?: boolean;
  message?: string;
  message_vi?: string;
}

interface SaveConfigResponse {
  success?: boolean;
  redirect?: string;
  message?: string;
  webhook_registered?: boolean;
  errors?: string[];
}

// localStorage persistence key
// SECURITY: persist ONLY the step number, never raw API keys.
const WIZARD_STORAGE_KEY = 'sophia-wizard-state-v2';

interface PersistedWizardState {
  step: number;
}

function loadPersistedState(): PersistedWizardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'step' in parsed && typeof (parsed as { step: unknown }).step === 'number') {
      return { step: (parsed as { step: number }).step };
    }
    return null;
  } catch {
    return null;
  }
}

function clearPersistedState(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    // Also clear legacy v1 key that may contain plaintext keys from earlier sessions
    localStorage.removeItem('sophia-wizard-state-v1');
  }
}

export function WizardClient() {
  const router = useRouter();
  const t = useTranslations('setupWizard');
  const locale = useLocale();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [webhookWarning, setWebhookWarning] = useState(false);

  const defaultConfig = {
    OPENROUTER_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DID_API_KEY: '',
    MUAPI_API_KEY: '',
  };

  const defaultProviderConfig: ProviderConfig = {
    HEYGEN_API_KEY: '',
    RESEND_API_KEY: '',
    NOWPAYMENTS_API_KEY: '',
    HEYGEN_WEBHOOK_SECRET: '',
  };

  const [config, setConfig] = useState(defaultConfig);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(defaultProviderConfig);
  const [savedCredentials, setSavedCredentials] = useState<CredentialSummary[]>([]);

  // Hydrate from localStorage on mount
  // SECURITY: only restores step number; API keys are NEVER persisted.
  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted) {
      setStep(persisted.step);
    }
  }, []);

  useEffect(() => {
    fetch('/api/setup-wizard/list-credentials')
      .then((r) => r.json() as Promise<{ credentials?: CredentialSummary[] }>)
      .then((data) => {
        if (data.credentials) setSavedCredentials(data.credentials);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

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
  const [nextError, setNextError] = useState<string | null>(null);

  // Persist ONLY step number to localStorage
  // SECURITY: never persist config/providerConfig (contain raw API keys).
  useEffect(() => {
    try {
      const state: PersistedWizardState = { step };
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
    } catch { /* storage full — non-fatal */ }
  }, [step]);

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setStatus(prev => ({ ...prev, [key]: 'idle' }));
  };

  const updateProviderConfig = (key: keyof ProviderConfig, value: string) => {
    setProviderConfig(prev => ({ ...prev, [key]: value }));
    setStatus(prev => ({ ...prev, [key]: 'idle' }));
  };

  const getLocalizedMessage = (data: VerifyKeyResponse): string => {
    if (locale === 'vi' && data.message_vi) return data.message_vi;
    return data.message ?? 'Test failed';
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
      const isValid = data.valid === true || data.ok === true;

      if (isValid) {
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
      } else {
        setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
        setErrors(prev => ({ ...prev, [keyName]: getLocalizedMessage(data) }));
      }
      return isValid;
    } catch {
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({
        ...prev,
        [keyName]: locale === 'vi'
          ? 'Xác minh thất bại — kiểm tra kết nối mạng'
          : 'Verification failed — check network connection',
      }));
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
      const isOk = data.ok === true || data.valid === true;
      setStatus(prev => ({ ...prev, [fieldKey]: isOk ? 'valid' : 'invalid' }));
      if (!isOk) setErrors(prev => ({ ...prev, [fieldKey]: getLocalizedMessage(data) }));
      return isOk;
    } catch {
      setStatus(prev => ({ ...prev, [fieldKey]: 'invalid' }));
      setErrors(prev => ({
        ...prev,
        [fieldKey]: locale === 'vi' ? 'Yêu cầu kiểm tra thất bại' : 'Test request failed',
      }));
      return false;
    }
  };

  const handleNext = () => {
    setNextError(null);
    if (step === 2) {
      const hasInvalid = Object.values(status).some(v => v === 'invalid');
      if (hasInvalid) {
        setNextError(t('alerts.invalidKey'));
        return;
      }
      const hasLlmKey =
        config.OPENROUTER_API_KEY.trim().length > 0 ||
        config.ANTHROPIC_API_KEY.trim().length > 0;
      if (!hasLlmKey) {
        setNextError(t('alerts.missingLlm'));
        return;
      }
    }

    if (step === 3) {
      const heygenSaved = savedCredentials.find((c) => c.provider === 'heygen');
      const heygenEntered = providerConfig.HEYGEN_API_KEY.trim().length > 0;
      if (!heygenSaved && !heygenEntered) {
        setNextError(t('alerts.missingHeygen'));
        return;
      }
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setStep(prev => prev + 1);
      setIsTransitioning(false);
    }, 0);
  };

  const handleSave = useCallback(async (attempt = 1) => {
    setLoading(true);
    setSaveError(null);
    setSaveFailed(false);
    if (attempt > 1) setRetryCount(attempt - 1);

    if (attempt > 1) {
      await new Promise(r => setTimeout(r, (attempt - 1) * 1000));
    }

    try {
      const llmRes = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      const llmData = (await llmRes.json()) as SaveConfigResponse;
      if (!llmData.success) {
        const msg = llmData.message
          ?? (locale === 'vi' ? 'Không thể lưu khoá API.' : 'Failed to save API keys.');
        if (attempt < 3) {
          setSaveError(locale === 'vi'
            ? `Đang thử lại (${attempt}/3)…`
            : `Retrying (${attempt}/3)…`);
          setLoading(false);
          void handleSave(attempt + 1);
          return;
        }
        setSaveError(msg);
        setSaveFailed(true);
        setRetryCount(0);
        return;
      }

      const credPayload: Record<string, string> = {};
      if (providerConfig.HEYGEN_API_KEY.trim()) credPayload.heygen_api_key = providerConfig.HEYGEN_API_KEY.trim();
      if (providerConfig.RESEND_API_KEY.trim()) credPayload.resend_api_key = providerConfig.RESEND_API_KEY.trim();
      if (providerConfig.NOWPAYMENTS_API_KEY.trim()) credPayload.nowpayments_api_key = providerConfig.NOWPAYMENTS_API_KEY.trim();
      if (providerConfig.HEYGEN_WEBHOOK_SECRET.trim()) credPayload.heygen_webhook_secret = providerConfig.HEYGEN_WEBHOOK_SECRET.trim();

      if (Object.keys(credPayload).length > 0) {
        const credRes = await fetch('/api/setup-wizard/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credPayload),
        });
        const credData = (await credRes.json()) as SaveConfigResponse;
        if (!credData.success) {
          const msg = credData.message
            ?? (locale === 'vi' ? 'Không thể lưu thông tin nhà cung cấp.' : 'Failed to save provider credentials.');
          if (attempt < 3) {
            setSaveError(locale === 'vi'
              ? `Đang thử lại (${attempt}/3)…`
              : `Retrying (${attempt}/3)…`);
            setLoading(false);
            void handleSave(attempt + 1);
            return;
          }
          setSaveError(msg);
          setSaveFailed(true);
          setRetryCount(0);
          return;
        }
        if (credData.webhook_registered === false) {
          setWebhookWarning(true);
        }
      }

      clearPersistedState();
      setRetryCount(0);
      router.push(llmData.redirect || '/dashboard/settings');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < 3) {
        setSaveError(locale === 'vi'
          ? `Đang thử lại (${attempt}/3)…`
          : `Retrying (${attempt}/3)…`);
        setLoading(false);
        void handleSave(attempt + 1);
        return;
      }
      setSaveError(locale === 'vi'
        ? `Lưu cấu hình thất bại: ${msg}`
        : `Failed to save configuration: ${msg}`);
      setSaveFailed(true);
      setRetryCount(0);
    } finally {
      setLoading(false);
    }
  }, [config, providerConfig, locale, router]);

  return (
    <div data-testid="setup-wizard-root" className="min-h-screen bg-muted/50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
        <div className="bg-primary px-8 py-6 text-primary-foreground text-center">
            <h1 className="text-3xl font-bold">{t('header.title')}</h1>
            <p className="mt-2 text-primary-foreground/80">{t('header.subtitle')}</p>
        </div>

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
              <>
                {webhookWarning && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                    <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" />
                    <span>{t('save.webhookWarning')}</span>
                  </div>
                )}
                <ProviderCredentialsStep
                  config={providerConfig}
                  updateConfig={updateProviderConfig}
                  status={status}
                  errors={errors}
                  onTestKey={testProviderKey}
                  savedCredentials={savedCredentials}
                />
              </>
            )}

            {step === 4 && <LocalModeStep />}

            {step === 5 && (
              <>
                {saveError && retryCount > 0 && (
                  <div className="mb-4 rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-900/10 p-3 text-sm text-blue-800 dark:text-blue-300">
                    {saveError}
                  </div>
                )}
                {saveFailed && (
                  <div className="mb-4 rounded-lg border border-red-400 bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-800 dark:text-red-300">
                    <p className="font-medium">{saveError}</p>
                    <p className="mt-2">
                      <Link href="/dashboard/settings" className="underline underline-offset-2 hover:opacity-80 font-medium">
                        {t('save.manualSetup')}
                      </Link>
                    </p>
                  </div>
                )}
                <FinishStep saveError={saveFailed ? saveError : null} saveFailed={saveFailed} onRetry={() => void handleSave(1)} />
              </>
            )}
        </div>

        <div className="bg-muted/50 px-8 py-6 flex justify-between items-center border-t border-border">
            {step > 1 && step < 5 && (
                <button
                    onClick={() => { setNextError(null); setStep(prev => prev - 1); }}
                    className="text-muted-foreground hover:text-foreground font-medium px-4 py-2"
                >
                    {t('actions.back')}
                </button>
            )}

            {step === 1 && <div />}

            {nextError && (
              <div
                role="alert"
                className="ml-auto mr-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive max-w-xs"
              >
                <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" />
                <span>{nextError}</span>
              </div>
            )}

            {step < 5 ? (
                <button
                    onClick={handleNext}
                    disabled={isTransitioning}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ml-auto disabled:opacity-70"
                >
                    {isTransitioning ? (
                        <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                        <>{t('actions.next')} <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                    )}
                </button>
            ) : (
                <button
                    onClick={() => void handleSave(1)}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 ml-auto w-full justify-center sm:w-auto"
                >
                    {loading ? (
                        <>
                          {retryCount > 0
                            ? (locale === 'vi'
                                ? `Đang thử lại (${retryCount}/3)…`
                                : `Retrying (${retryCount}/3)…`)
                            : t('actions.saving')
                          }
                          <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
                        </>
                    ) : (
                        <>{t('actions.launch')} <Save className="w-4 h-4" aria-hidden="true" /></>
                    )}
                </button>
            )}
        </div>
      </div>

      <p className="mt-8 text-muted-foreground text-sm">{t('footer')}</p>
    </div>
  );
}
