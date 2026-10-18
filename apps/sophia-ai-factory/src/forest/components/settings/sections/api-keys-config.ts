'use client';

import type { UserProfileFormValues } from '@/land/schemas/settings';

export interface KeyConfig {
  id: keyof UserProfileFormValues['apiKeys'];
  label: string;
  descKey: string;
  helpKey: string;
  placeholder: string;
  helpUrl: string;
}

export const KEY_CONFIGS: KeyConfig[] = [
  { id: 'openai',     label: 'OpenAI / OpenRouter', descKey: 'openaiDesc',     helpKey: 'openaiHelp',     placeholder: 'sk-...',     helpUrl: 'https://openrouter.ai/keys' },
  { id: 'anthropic',  label: 'Anthropic (Claude)',  descKey: 'anthropicDesc',  helpKey: 'anthropicHelp',  placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'elevenlabs', label: 'ElevenLabs',           descKey: 'elevenlabsDesc', helpKey: 'elevenlabsHelp', placeholder: 'xi-...',     helpUrl: 'https://elevenlabs.io/subscription' },
  { id: 'heygen',     label: 'HeyGen',               descKey: 'heygenDesc',     helpKey: 'heygenHelp',     placeholder: 'hg-...',     helpUrl: 'https://app.heygen.com/settings/api-keys' },
  { id: 'muapi',      label: 'MuAPI (Media AI)',     descKey: 'muapiDesc',      helpKey: 'muapiHelp',      placeholder: 'mu-...',     helpUrl: 'https://muapi.ai/dashboard' },
];

export interface VerifyApiKeyOutcome {
  isValid: boolean;
  durationMs: number;
  errorMessage?: string;
}

export async function verifyApiKeyRequest(
  keyId: string,
  keyValue: string,
): Promise<VerifyApiKeyOutcome> {
  const startTime = performance.now();

  let res: Response;
  if (keyId === 'heygen') {
    res = await fetch('/api/setup-wizard/test-heygen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: keyValue }),
    });
  } else {
    const service = keyId === 'openai' ? 'openrouter' : keyId;
    res = await fetch('/api/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, key: keyValue }),
    });
  }

  const endTime = performance.now();
  const durationMs = Math.round(endTime - startTime);

  const data = (await res.json()) as { valid?: boolean; ok?: boolean; message?: string };
  const isValid = data.valid === true || data.ok === true;

  return {
    isValid,
    durationMs,
    errorMessage: isValid ? undefined : (data.message || 'Verification failed'),
  };
}
