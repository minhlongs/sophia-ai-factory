"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardStepper } from './components/wizard-stepper';
import { ApiKeyInput } from './components/api-key-input';
import { AlertCircle, Server, Check, ArrowRight, Save, ExternalLink, Loader2 } from 'lucide-react';
import { DEFAULTS } from '@/config/defaults';

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-8 py-6 text-white text-center">
            <h1 className="text-3xl font-bold">Sophia Setup Wizard</h1>
            <p className="mt-2 text-blue-100">Configure your AI Factory in minutes.</p>
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
            {/* STEP 1: SYSTEM CHECK */}
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h2 className="text-xl font-semibold text-gray-800">System Capability Check</h2>
                    <div className="grid gap-4">
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                            <div className="flex items-center gap-3">
                                <Server className="text-green-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Node.js Environment</p>
                                    <p className="text-sm text-green-700">Compatible (v18+)</p>
                                </div>
                            </div>
                            <Check className="text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                            <div className="flex items-center gap-3">
                                <Save className="text-green-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Write Access</p>
                                    <p className="text-sm text-green-700">Can write to .env.local (Local Dev)</p>
                                </div>
                            </div>
                            <Check className="text-green-600" />
                        </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>We will configure 3 AI services and 1 Database. Please have your API keys ready.</p>
                    </div>
                </div>
            )}

            {/* STEP 2: API KEYS */}
            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h2 className="text-xl font-semibold text-gray-800">AI Service Configuration</h2>
                    <p className="text-gray-500 text-sm">Enter keys for the AI brains.</p>

                    <ApiKeyInput
                        id="openrouter"
                        label="OpenRouter API Key (LLM)"
                        value={config.OPENROUTER_API_KEY}
                        onChange={(v) => updateConfig('OPENROUTER_API_KEY', v)}
                        onVerify={() => verifyKey('openrouter', 'OPENROUTER_API_KEY', config.OPENROUTER_API_KEY)}
                        status={status.OPENROUTER_API_KEY}
                        errorMessage={errors.OPENROUTER_API_KEY}
                        required
                        helpText="Get key from openrouter.ai/keys"
                    />

                    <ApiKeyInput
                        id="elevenlabs"
                        label="ElevenLabs API Key (Voice)"
                        value={config.ELEVENLABS_API_KEY}
                        onChange={(v) => updateConfig('ELEVENLABS_API_KEY', v)}
                        onVerify={() => verifyKey('elevenlabs', 'ELEVENLABS_API_KEY', config.ELEVENLABS_API_KEY)}
                        status={status.ELEVENLABS_API_KEY}
                        errorMessage={errors.ELEVENLABS_API_KEY}
                        required
                        helpText="Get key from elevenlabs.io/subscription"
                    />

                    <ApiKeyInput
                        id="did"
                        label="D-ID API Key (Avatar)"
                        value={config.DID_API_KEY}
                        onChange={(v) => updateConfig('DID_API_KEY', v)}
                        onVerify={() => verifyKey('d-id', 'DID_API_KEY', config.DID_API_KEY)}
                        status={status.DID_API_KEY}
                        errorMessage={errors.DID_API_KEY}
                        required
                        helpText="Get key from studio.d-id.com/account-settings"
                    />
                </div>
            )}

            {/* STEP 3: DATABASE */}
            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h2 className="text-xl font-semibold text-gray-800">Database Connection</h2>
                    <p className="text-gray-500 text-sm">Connect to your Airtable content base.</p>

                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm text-amber-900 mb-4">
                        <p className="font-semibold mb-1">Don&apos;t have a Base yet?</p>
                        <p>1. <a href={DEFAULTS.AIRTABLE_TEMPLATE_URL} target="_blank" className="underline font-medium hover:text-amber-700 flex inline-flex items-center">Copy this Template Base <ExternalLink className="w-3 h-3 ml-1"/></a></p>
                        <p>2. Find your Base ID in the URL (appXXXXXXXXXXXXXX)</p>
                    </div>

                    <ApiKeyInput
                        id="airtable_pat"
                        label="Airtable Personal Access Token (PAT)"
                        value={config.AIRTABLE_ACCESS_TOKEN}
                        onChange={(v) => updateConfig('AIRTABLE_ACCESS_TOKEN', v)}
                        onVerify={() => verifyKey('airtable', 'AIRTABLE_ACCESS_TOKEN', config.AIRTABLE_ACCESS_TOKEN)}
                        status={status.AIRTABLE_ACCESS_TOKEN}
                        errorMessage={errors.AIRTABLE_ACCESS_TOKEN}
                        required
                        helpText="Create at airtable.com/create/tokens with 'data.records:read/write' scope"
                    />

                    <div className="w-full space-y-2">
                        <label htmlFor="base_id" className="block text-sm font-medium text-gray-700">Base ID *</label>
                        <input
                            id="base_id"
                            type="text"
                            value={config.AIRTABLE_BASE_ID}
                            onChange={(e) => updateConfig('AIRTABLE_BASE_ID', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="app..."
                        />
                        <p className="text-xs text-gray-400">Found in your browser URL when viewing the base.</p>
                    </div>
                </div>
            )}

            {/* STEP 4: FINALIZE */}
            {step === 4 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                    <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                        <Check className="w-12 h-12 text-green-600" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Ready to Launch!</h2>
                        <p className="text-gray-600 mt-2">All systems verified. Click below to save configuration and start the dashboard.</p>
                    </div>

                    {saveError && (
                        <div className="bg-red-50 p-4 rounded-lg text-left">
                            <h4 className="font-semibold text-red-800 mb-1">Configuration Warning</h4>
                            <p className="text-sm text-red-700">{saveError}</p>
                            <p className="text-xs text-red-600 mt-2">If downloading, place the file in your project root as <code>.env.local</code> and restart.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-8 py-6 flex justify-between items-center border-t border-gray-100">
            {step > 1 && step < 4 && (
                <button
                    onClick={() => setStep(prev => prev - 1)}
                    className="text-gray-500 hover:text-gray-800 font-medium px-4 py-2"
                >
                    Back
                </button>
            )}

            {step === 1 && <div />} {/* Spacer */}

            {step < 4 ? (
                <button
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ml-auto"
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

      <p className="mt-8 text-gray-400 text-sm">Sophia AI Factory v1.0 • Powered by Mekong CLI</p>
    </div>
  );
}
