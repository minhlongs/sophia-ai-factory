'use client';

/**
 * Storage Settings Hook (Cloudflare R2 BYOS)
 * Manages loading, validation, masking, and persistence for R2 storage credentials.
 *
 * @module components/settings/use-storage-settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useCsrfToken } from '@/seed/security/use-csrf-token';

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

export function useStorageSettings() {
  const csrfHeaders = useCsrfToken();
  const [formData, setFormData] = useState<StorageFormData>(INITIAL_STORAGE_FORM);
  const [isMasked, setIsMasked] = useState<{ accessKey: boolean; secretKey: boolean }>({
    accessKey: true,
    secretKey: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/settings/storage');
      if (res.ok) {
        const data = (await res.json()) as { value?: Partial<StorageFormData> };
        const val = data.value || {};
        setFormData({
          r2AccessKeyId: val.r2AccessKeyId || '',
          r2SecretAccessKey: val.r2SecretAccessKey || '',
          r2BucketName: val.r2BucketName || '',
          r2Endpoint: val.r2Endpoint || '',
          r2PublicBaseUrl: val.r2PublicBaseUrl || '',
          useTenantStorage: Boolean(val.useTenantStorage),
        });
        setIsMasked({
          accessKey: Boolean(val.r2AccessKeyId),
          secretKey: Boolean(val.r2SecretAccessKey),
        });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to load storage configuration.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = (field: keyof StorageFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'r2AccessKeyId') setIsMasked((m) => ({ ...m, accessKey: false }));
    if (field === 'r2SecretAccessKey') setIsMasked((m) => ({ ...m, secretKey: false }));
  };

  const toggleMask = (field: 'accessKey' | 'secretKey') => {
    setIsMasked((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const saveSettings = async (): Promise<boolean> => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
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
        setStatusMessage({
          type: 'error',
          text: err.message || err.error || 'Failed to save storage settings.',
        });
        return false;
      }

      setStatusMessage({
        type: 'success',
        text: 'Cloudflare R2 storage credentials saved successfully.',
      });
      setIsMasked({
        accessKey: Boolean(payload.r2AccessKeyId),
        secretKey: Boolean(payload.r2SecretAccessKey),
      });
      return true;
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error saving storage settings.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    formData,
    isMasked,
    isLoading,
    isSaving,
    statusMessage,
    setStatusMessage,
    updateField,
    toggleMask,
    saveSettings,
    loadSettings,
  };
}
