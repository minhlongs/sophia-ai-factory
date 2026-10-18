/**
 * Setup Wizard API Action Requests (Validate, Revoke, Save BYOK Keys)
 *
 * Layer: tree/components/setup-wizard/steps
 * @module tree/components/setup-wizard/steps/use-setup-wizard-actions
 */

import { KEY_TO_PROVIDER, type WizardKeyConfig } from './use-setup-wizard-helpers';

export interface ValidateKeyResponse {
  valid: boolean;
  latencyMs: number;
  errorMessage?: string;
}

export async function requestKeyValidation(
  service: string,
  keyValue: string,
  fallbackError: string,
): Promise<ValidateKeyResponse> {
  const start = Date.now();
  const res = await fetch('/api/setup-wizard/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: service, api_key: keyValue }),
  });
  const data = (await res.json()) as {
    valid?: boolean;
    message?: string;
    message_vi?: string;
    latencyMs?: number;
  };
  const latencyMs = data.latencyMs ?? (Date.now() - start);
  if (res.ok && data.valid) {
    return { valid: true, latencyMs };
  }
  const errorMessage = data.message_vi || data.message || fallbackError;
  return { valid: false, latencyMs, errorMessage };
}

export async function requestProviderRevoke(provider: string): Promise<boolean> {
  const res = await fetch('/api/user/byok', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  return res.ok;
}

export async function requestProviderKeySave(
  provider: string,
  key: string,
  fallbackError: string,
): Promise<void> {
  const res = await fetch('/api/user/byok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key }),
  });
  if (!res.ok) {
    const d = (await res.json()) as { error?: string };
    throw new Error(d.error || fallbackError);
  }
}

export async function validateAndSaveConfiguredKeys(params: {
  config: WizardKeyConfig;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  verifyKey: (service: string, keyName: string, keyValue: string) => Promise<boolean>;
  saveFailedFallback: string;
}): Promise<string[]> {
  const { config, status, verifyKey, saveFailedFallback } = params;
  const entries = Object.entries(config).filter(([k, v]) => KEY_TO_PROVIDER[k] && v.trim());
  const newlySaved: string[] = [];

  for (const [k, v] of entries) {
    const provider = KEY_TO_PROVIDER[k];
    if (status[k] !== 'valid') {
      const isValid = await verifyKey(provider, k, v);
      if (!isValid) {
        throw new Error(
          `Xác thực ${provider} không thành công / Verification for ${provider} failed. Please verify API key with upstream provider.`,
        );
      }
    }
  }

  for (const [k, v] of entries) {
    const provider = KEY_TO_PROVIDER[k];
    await requestProviderKeySave(provider, v, saveFailedFallback);
    newlySaved.push(provider);
  }

  return newlySaved;
}
