'use client';

export interface StorageFormData {
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2Endpoint: string;
  r2PublicBaseUrl: string;
  useTenantStorage: boolean;
}

export const INITIAL_STORAGE_FORM: StorageFormData = {
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2BucketName: '',
  r2Endpoint: '',
  r2PublicBaseUrl: '',
  useTenantStorage: false,
};

export const MASKED_PLACEHOLDER = '••••••••••••••••';

export async function fetchStorageSettings(): Promise<{
  formData: StorageFormData;
  isMasked: { accessKey: boolean; secretKey: boolean };
} | null> {
  const res = await fetch('/api/v1/settings/storage');
  if (!res.ok) return null;
  const data = (await res.json()) as { value?: Partial<StorageFormData> };
  const val = data.value || {};
  return {
    formData: {
      r2AccessKeyId: val.r2AccessKeyId || '',
      r2SecretAccessKey: val.r2SecretAccessKey || '',
      r2BucketName: val.r2BucketName || '',
      r2Endpoint: val.r2Endpoint || '',
      r2PublicBaseUrl: val.r2PublicBaseUrl || '',
      useTenantStorage: Boolean(val.useTenantStorage),
    },
    isMasked: {
      accessKey: Boolean(val.r2AccessKeyId),
      secretKey: Boolean(val.r2SecretAccessKey),
    },
  };
}

export async function patchStorageSettings(
  formData: StorageFormData,
  csrfHeaders: Record<string, string>,
): Promise<
  | { ok: true; isMasked: { accessKey: boolean; secretKey: boolean } }
  | { ok: false; errorText: string }
> {
  const payload = {
    r2AccessKeyId: formData.r2AccessKeyId.trim() || null,
    r2SecretAccessKey: formData.r2SecretAccessKey.trim() || null,
    r2BucketName: formData.r2BucketName.trim() || null,
    r2Endpoint: formData.r2Endpoint.trim() || null,
    r2PublicBaseUrl: formData.r2PublicBaseUrl.trim() || null,
    useTenantStorage: formData.useTenantStorage,
  };

  const res = await fetch('/api/v1/settings/storage', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return {
      ok: false,
      errorText: err.message || err.error || 'Failed to save storage settings.',
    };
  }

  return {
    ok: true,
    isMasked: {
      accessKey: Boolean(payload.r2AccessKeyId),
      secretKey: Boolean(payload.r2SecretAccessKey),
    },
  };
}
