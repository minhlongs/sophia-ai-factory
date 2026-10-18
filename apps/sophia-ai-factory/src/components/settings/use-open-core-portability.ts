/**
 * Open-Core Edition Status & Workspace Portability Hook
 *
 * Encapsulates status fetching, license key preview validation,
 * and D1 workspace bundle export/import state for `OpenCorePortabilityPanel`.
 */

'use client';

import { useEffect, useState } from 'react';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import type { FeatureGateEvaluation } from '@/seed/config/edition-config';
import type { OpenCore25StepCatalogReport } from '@/tree/open-core/open-core-25-steps-auditor';

export interface StatusApiResponse {
  success: boolean;
  edition: 'community' | 'cloud' | 'enterprise';
  userTier?: string;
  licensedTier?: string | null;
  features: FeatureGateEvaluation[];
  catalogAudit?: OpenCore25StepCatalogReport | null;
}

export function useOpenCorePortability() {
  const csrfHeaders = useCsrfToken();
  const [statusData, setStatusData] = useState<StatusApiResponse | null>(null);
  const [selectedGate, setSelectedGate] = useState<FeatureGateEvaluation | null>(null);
  const [validationFeedback, setValidationFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [bundleJson, setBundleJson] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/open-core/status')
      .then(async (r) => (r.ok ? ((await r.json()) as StatusApiResponse) : null))
      .then((json) => { if (active && json?.success) setStatusData(json); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleValidateLicensePreview = async (licenseKey: string) => {
    setValidationFeedback(null);
    const res = await fetch('/api/open-core/status', {
      method: 'POST',
      headers: { ...csrfHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });
    const data = (await res.json()) as {
      valid?: boolean;
      reason?: string;
      licenseSummary?: { tier: string; edition: string };
    };
    if (res.ok && data.valid && data.licenseSummary) {
      setValidationFeedback({
        ok: true,
        message: `Verified preview: ${data.licenseSummary.tier} (${data.licenseSummary.edition}). Set RAAS_LICENSE_KEY in server env to persist.`,
      });
    } else {
      setValidationFeedback({
        ok: false,
        message: `Validation failed: ${data.reason ?? 'INVALID_LICENSE_KEY'}`,
      });
    }
  };

  const handleExportWorkspace = async () => {
    setIsBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/open-core/portability');
      const data = (await res.json()) as { success?: boolean; bundle?: unknown; message?: string };
      if (res.ok && data.success && data.bundle) {
        setBundleJson(JSON.stringify(data.bundle, null, 2));
        setNotice('Exported signed workspace bundle from D1 settings (no plaintext keys included).');
      } else {
        setNotice(data.message ?? 'Failed to export workspace bundle.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportWorkspace = async () => {
    if (!bundleJson.trim()) return;
    setIsBusy(true);
    setNotice(null);
    try {
      const parsed = JSON.parse(bundleJson) as unknown;
      const res = await fetch('/api/open-core/portability', {
        method: 'POST',
        headers: { ...csrfHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { success?: boolean; persisted?: boolean; message?: string };
      if (res.ok && data.success) {
        setNotice(
          data.persisted
            ? 'Workspace configuration verified and persisted to D1.'
            : 'Workspace bundle verified (preview mode — D1 binding unavailable).',
        );
      } else {
        setNotice(data.message ?? 'Checksum or schema validation failed.');
      }
    } catch {
      setNotice('Invalid JSON bundle format.');
    } finally {
      setIsBusy(false);
    }
  };

  return {
    statusData, selectedGate, setSelectedGate,
    validationFeedback, setValidationFeedback,
    bundleJson, setBundleJson, notice, isBusy,
    handleValidateLicensePreview, handleExportWorkspace, handleImportWorkspace,
  };
}
