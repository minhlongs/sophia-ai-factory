'use client';

/**
 * Storage Settings Hook (Cloudflare R2 BYOS)
 * Manages loading, validation, masking, and persistence for R2 storage credentials.
 *
 * @module components/settings/use-storage-settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import {
  type StorageFormData,
  INITIAL_STORAGE_FORM,
  MASKED_PLACEHOLDER,
  fetchStorageSettings,
  patchStorageSettings,
} from './storage-settings-api';

export { type StorageFormData, INITIAL_STORAGE_FORM, MASKED_PLACEHOLDER };

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
      const loaded = await fetchStorageSettings();
      if (loaded) {
        setFormData(loaded.formData);
        setIsMasked(loaded.isMasked);
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
      const result = await patchStorageSettings(formData, csrfHeaders);
      if (!result.ok) {
        setStatusMessage({ type: 'error', text: result.errorText });
        return false;
      }

      setStatusMessage({
        type: 'success',
        text: 'Cloudflare R2 storage credentials saved successfully.',
      });
      setIsMasked(result.isMasked);
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
