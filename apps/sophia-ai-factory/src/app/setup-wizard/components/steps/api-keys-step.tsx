import React from 'react';
import { ApiKeyInput } from '../api-key-input';

interface ApiKeysStepProps {
  config: {
    OPENROUTER_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    DID_API_KEY: string;
  };
  updateConfig: (key: string, value: string) => void;
  verifyKey: (service: string, keyName: string, keyValue: string) => Promise<boolean>;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  errors: Record<string, string>;
}

export function ApiKeysStep({ config, updateConfig, verifyKey, status, errors }: ApiKeysStepProps) {
  return (
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
  );
}
