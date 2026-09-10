"use client";

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { WelcomeStep } from './welcome-step';
import { AccountStep } from './account-step';
import { ApiKeysStep } from './api-keys-step';
import { PaymentStep } from './payment-step';
import { FinishStep } from './finish-step';
import { WizardStepper } from '@/tree/components/setup-wizard/wizard-stepper';
import { ByokDoctrineBanner } from '@/tree/components/setup-wizard/byok-doctrine-banner';
import { Compass, HelpCircle, ArrowRight, ArrowLeft } from 'lucide-react';

const STEPS = ['Welcome', 'Account', 'AI Keys', 'Billing', 'Blueprint', 'Ready'] as const;

function MissionBlueprintStep({
  onNext,
  onBack,
  saveError,
  isSaving,
}: {
  onNext: () => void;
  onBack: () => void;
  saveError?: string | null;
  isSaving?: boolean;
}) {
  const faqs = [
    { q: 'WHAT DO I ENTER? / Tôi cần nhập gì?', a: 'Paste a product link, blog URL, or 1-line concept. Sophia handles viral hooks.' },
    { q: 'WHAT WILL SOPHIA DO? / Sophia sẽ làm gì?', a: 'Generates scripts, synthesizes voice, renders AI imagery, adds captions & produces MP4.' },
    { q: 'HOW LONG WILL IT TAKE? / Mất bao lâu?', a: '60 to 90 seconds from click to finished campaign video.' },
    { q: 'WHAT WILL IT COST? / Chi phí bao nhiêu?', a: '~$0.03 provider API compute (direct at 0% markup) + 40 MCU from your monthly plan.' },
    { q: 'WHERE WILL RESULT APPEAR? / Kết quả ở đâu?', a: 'Directly in your Mission Dashboard with instant Telegram preview bot alerts.' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
          <Compass className="w-3.5 h-3.5" />
          First Campaign Blueprint / Kế hoạch Video Đầu Tiên
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          How Sophia Runs Your First Mission / Quy trình khởi tạo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Everything non-technical CEOs need to know before launching their first autonomous video.
        </p>
      </div>

      <div className="grid gap-2.5">
        {faqs.map((item, idx) => (
          <div key={idx} className="p-3.5 rounded-xl border border-border bg-card/80 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <h4 className="font-semibold text-foreground">{item.q}</h4>
              <p className="text-muted-foreground">{item.a}</p>
            </div>
          </div>
        ))}
      </div>

      {saveError && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive font-medium">
          {saveError}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại / Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          {isSaving ? 'Đang lưu / Saving...' : 'Tiếp tục / Continue'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function SetupWizardPage() {
  const t = useTranslations('setupWizard');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [config, setConfig] = useState({
    OPENROUTER_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DID_API_KEY: '',
    MUAPI_API_KEY: '',
    REPLICATE_API_KEY: '',
    FAL_API_KEY: '',
  });
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateConfig = useCallback((key: string, value: string) => {
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
      const res = await fetch('/api/setup-wizard/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: service, api_key: keyValue }),
      });
      const data = await res.json() as { valid?: boolean; message?: string; message_vi?: string; latencyMs?: number };
      const latency = data.latencyMs ?? (Date.now() - start);
      if (res.ok && data.valid) {
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

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    setSaveFailed(false);
    setIsSaving(true);
    try {
      const keyMap: Record<string, string> = {
        OPENROUTER_API_KEY: 'openrouter',
        ANTHROPIC_API_KEY: 'anthropic',
        ELEVENLABS_API_KEY: 'elevenlabs',
        DID_API_KEY: 'd-id',
        MUAPI_API_KEY: 'muapi',
        REPLICATE_API_KEY: 'replicate',
        FAL_API_KEY: 'fal-ai',
      };
      const entries = Object.entries(config).filter(([k, v]) => keyMap[k] && v.trim());
      for (const [k, v] of entries) {
        const res = await fetch('/api/user/byok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: keyMap[k], key: v }),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          throw new Error(d.error || t('errors.saveFailed'));
        }
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errors.saveFailed');
      setSaveError(msg);
      setSaveFailed(true);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [t, config]);

  const handleNext = useCallback(async () => {
    if (currentStepIndex === 4) {
      const saved = await handleSave();
      if (!saved) {
        // FAIL-CLOSED: Stop advancement if saving credentials failed
        return;
      }
    }
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, handleSave]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) setCurrentStepIndex(prev => prev - 1);
  }, [currentStepIndex]);

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <WizardStepper currentStep={currentStepIndex + 1} steps={Array.from(STEPS)} />
        <ByokDoctrineBanner />
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          {currentStepIndex === 0 && <WelcomeStep onNext={handleNext} />}
          {currentStepIndex === 1 && <AccountStep onNext={handleNext} onBack={handleBack} />}
          {currentStepIndex === 2 && (
            <ApiKeysStep config={config} updateConfig={updateConfig} verifyKey={verifyKey} status={status} errors={errors} latencies={latencies} onNext={handleNext} onBack={handleBack} />
          )}
          {currentStepIndex === 3 && <PaymentStep onNext={handleNext} onBack={handleBack} />}
          {currentStepIndex === 4 && (
            <MissionBlueprintStep
              onNext={handleNext}
              onBack={handleBack}
              saveError={saveError}
              isSaving={isSaving}
            />
          )}
          {currentStepIndex === 5 && (
            <FinishStep
              saveError={saveError}
              saveFailed={saveFailed}
              onRetry={handleSave}
              onNavigateToStep={setCurrentStepIndex}
            />
          )}
        </div>
      </div>
    </div>
  );
}
