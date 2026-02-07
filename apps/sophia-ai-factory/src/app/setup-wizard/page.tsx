"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardStepper } from './components/wizard-stepper';
import { ArrowRight, Save, Loader2 } from 'lucide-react';
import { SystemCheckStep } from './components/steps/system-check-step';
import { ApiKeysStep } from './components/steps/api-keys-step';
import { DatabaseStep } from './components/steps/database-step';
import { FinishStep } from './components/steps/finish-step';

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [config, setConfig] = useState({
    OPENROUTER_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DID_API_KEY: '',
    AIRTABLE_ACCESS_TOKEN: '',
    AIRTABLE_BASE_ID: '',
  });

  // Validation State
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({
    OPENROUTER_API_KEY: 'idle',
    ELEVENLABS_API_KEY: 'idle',
    DID_API_KEY: 'idle',
    AIRTABLE_ACCESS_TOKEN: 'idle',
    AIRTABLE_BASE_ID: 'idle',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    // Reset status on change
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

      const data = await res.json();

      if (data.valid) {
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
      } else {
        setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
        setErrors(prev => ({ ...prev, [keyName]: data.message || 'Invalid key' }));
      }
      return data.valid;
    } catch (error) {
      console.error("Verification error", error);
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: 'Verification failed' }));
      return false;
    }
  };

  const handleNext = () => {
    // Block if current step has invalid or unchecked required fields
    // Step 2: Keys
    if (step === 2) {
      if (status.OPENROUTER_API_KEY !== 'valid' || status.ELEVENLABS_API_KEY !== 'valid' || status.DID_API_KEY !== 'valid') {
        alert("Please verify all API keys before proceeding.");
        return;
      }
    }
    // Step 3: Airtable
    if (step === 3) {
        // We allow Base ID to be idle if PAT is valid, or require verification?
        // Let's require PAT verification.
        if (status.AIRTABLE_ACCESS_TOKEN !== 'valid') {
            alert("Please verify your Airtable Personal Access Token.");
            return;
        }
        if (!config.AIRTABLE_BASE_ID) {
            alert("Please enter an Airtable Base ID.");
            return;
        }
    }

    setStep(prev => prev + 1);
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const data = await res.json();

      if (data.success) {
        // Redirect to dashboard
        router.push('/');
      } else {
        // Show error or download option
        setSaveError(data.message);
        if (data.envContent) {
           // Provide download
           const blob = new Blob([data.envContent], { type: 'text/plain' });
           const url = window.URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = '.env.local';
           a.click();
        }
      }
    } catch (error) {
      setSaveError("Failed to save configuration.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-primary px-8 py-6 text-primary-foreground text-center">
            <h1 className="text-3xl font-bold">Sophia Setup Wizard</h1>
            <p className="mt-2 text-primary-foreground/80">Configure your AI Factory in minutes.</p>
        </div>

        {/* Stepper */}
        <div className="px-8">
            <WizardStepper
                currentStep={step}
                steps={["System", "AI Keys", "Database", "Finish"]}
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
              <DatabaseStep
                config={config}
                updateConfig={updateConfig}
                verifyKey={verifyKey}
                status={status}
                errors={errors}
              />
            )}

            {step === 4 && <FinishStep saveError={saveError} />}
        </div>

        {/* Footer Actions */}
        <div className="bg-muted/50 px-8 py-6 flex justify-between items-center border-t border-border">
            {step > 1 && step < 4 && (
                <button
                    onClick={() => setStep(prev => prev - 1)}
                    className="text-muted-foreground hover:text-foreground font-medium px-4 py-2"
                >
                    Back
                </button>
            )}

            {step === 1 && <div />} {/* Spacer */}

            {step < 4 ? (
                <button
                    onClick={handleNext}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ml-auto"
                >
                    Next Step <ArrowRight className="w-4 h-4" />
                </button>
            ) : (
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 ml-auto w-full justify-center sm:w-auto"
                >
                    {loading ? (
                        <>Saving <Loader2 className="w-4 h-4 animate-spin" /></>
                    ) : (
                        <>Launch Sophia <Save className="w-4 h-4" /></>
                    )}
                </button>
            )}
        </div>
      </div>

      <p className="mt-8 text-muted-foreground text-sm">Sophia AI Factory v1.0 • Powered by Mekong CLI</p>
    </div>
  );
}
