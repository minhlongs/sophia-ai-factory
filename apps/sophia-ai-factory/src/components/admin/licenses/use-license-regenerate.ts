'use client';

/**
 * Hook: useLicenseRegenerate — manages state and API call for license regeneration
 */

import { useState } from 'react';
import { LicenseSummary } from '@/lib/raas-schema';

export interface RegenerateResult {
  newKey?: string;
  warning?: string;
  newLicense?: LicenseSummary;
}

export interface RegenerateCallbackData {
  oldLicenseId: string;
  newKey: string;
  newLicense: LicenseSummary;
}

export function useLicenseRegenerate(
  propLicenseId: string | undefined,
  onRegenerate?: (data: RegenerateCallbackData) => void,
) {
  const [open, setOpen] = useState(false);
  const [licenseId, setLicenseId] = useState(propLicenseId || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRegenerate = async () => {
    if (!licenseId.trim()) {
      setResult({ warning: 'License ID is required' });
      return;
    }

    setLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch(`/api/admin/licenses/${licenseId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate license');
      }

      setResult({ newKey: data.newKey, newLicense: data.newLicense });

      onRegenerate?.({
        oldLicenseId: licenseId,
        newKey: data.newKey,
        newLicense: data.newLicense,
      });
    } catch (error) {
      setResult({
        warning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result?.newKey) {
      await navigator.clipboard.writeText(result.newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setResult(null);
        setCopied(false);
        if (!propLicenseId) setLicenseId('');
      }, 200);
    }
  };

  return {
    open,
    licenseId,
    setLicenseId,
    loading,
    result,
    copied,
    handleRegenerate,
    handleCopy,
    handleOpenChange,
  };
}
