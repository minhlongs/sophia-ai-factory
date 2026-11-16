/**
 * Setup Wizard API Action Requests (Validate, Revoke, Save BYOK Keys)
 *
 * Layer: tree/components/setup-wizard/steps
 * @module tree/components/setup-wizard/steps/use-setup-wizard-actions
 */

import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import type { ProviderProbeErrorCode } from '@/tree/byok/provider-probe-endpoints';
import { KEY_TO_PROVIDER, type WizardKeyConfig } from './use-setup-wizard-helpers';

export interface ValidateKeyResponse {
  valid: boolean;
  latencyMs: number;
  errorCode?: ProviderProbeErrorCode | null;
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
    headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
    body: JSON.stringify({ provider: service, api_key: keyValue }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    valid?: boolean;
    error?: string;
    errorCode?: ProviderProbeErrorCode | null;
    message?: string;
    message_vi?: string;
    latencyMs?: number;
  };
  const latencyMs = data.latencyMs ?? (Date.now() - start);
  if (res.ok && data.valid) {
    return { valid: true, latencyMs, errorCode: null };
  }
  if (res.status === 403 && data.error === 'csrf_token_invalid') {
    return {
      valid: false,
      latencyMs,
      errorCode: 'CSRF_REJECTED',
      errorMessage: 'Phiên bảo mật CSRF đã hết hạn. Vui lòng tải lại trang và thử lại.',
    };
  }
  if (res.status === 401) {
    return {
      valid: false,
      latencyMs,
      errorCode: 'UNAUTHORIZED',
      errorMessage: data.message_vi || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    };
  }
  const errorMessage = data.message_vi || data.message || fallbackError;
  return { valid: false, latencyMs, errorCode: data.errorCode ?? null, errorMessage };
}

export async function requestProviderRevoke(provider: string): Promise<boolean> {
  const res = await fetch('/api/user/byok', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
    body: JSON.stringify({ provider, key }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
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
