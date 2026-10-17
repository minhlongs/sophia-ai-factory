/**
 * Open-Core Edition Status & Workspace Portability Settings Panel
 *
 * Wired into Dashboard Settings (`settings-page.tsx`) to provide:
 * 1. Authenticated runtime edition & feature gate matrix (`GET /api/open-core/status`)
 * 2. Stateless RaaS License Key validation preview via `CommercialUpgradeModal`
 * 3. Tenant-scoped D1 workspace configuration bundle export & import
 *    (`GET` & `POST /api/open-core/portability` with CSRF protection).
 *
 * @module components/settings/open-core-portability-panel
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import type { FeatureGateEvaluation } from '@/seed/config/edition-config';
import type { OpenCore25StepCatalogReport } from '@/tree/open-core/open-core-25-steps-auditor';
import { CommercialUpgradeModal } from '@/components/open-core/commercial-upgrade-modal';
import { OpenCoreBlueprintMatrix } from './open-core-blueprint-matrix';
import {
  FeaturesMatrixView,
  PortabilityBoxView,
} from './open-core-portability-subviews';

interface StatusApiResponse {
  success: boolean;
  edition: 'community' | 'cloud' | 'enterprise';
  userTier?: string;
  licensedTier?: string | null;
  features: FeatureGateEvaluation[];
  catalogAudit?: OpenCore25StepCatalogReport | null;
}

export function OpenCorePortabilityPanel() {
  const locale = useLocale();
  const csrfHeaders = useCsrfToken();
  const [statusData, setStatusData] = useState<StatusApiResponse | null>(null);
  const [selectedGate, setSelectedGate] = useState<FeatureGateEvaluation | null>(null);
  const [validationFeedback, setValidationFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [bundleJson, setBundleJson] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/open-core/status')
      .then(async (r) => (r.ok ? ((await r.json()) as StatusApiResponse) : null))
      .then((json) => {
        if (active && json?.success) setStatusData(json);
      })
      .catch(() => {
        // Non-fatal in test/offline environments
      });
    return () => {
      active = false;
    };
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

  return (
    <div className="space-y-6">
      <FeaturesMatrixView
        edition={statusData?.edition}
        userTier={statusData?.userTier}
        features={statusData?.features ?? []}
        onSelectGate={(gate) => {
          setValidationFeedback(null);
          setSelectedGate(gate);
        }}
      />
      <PortabilityBoxView
        bundleJson={bundleJson}
        setBundleJson={setBundleJson}
        notice={notice}
        isBusy={isBusy}
        onExport={handleExportWorkspace}
        onImport={handleImportWorkspace}
      />
      <OpenCoreBlueprintMatrix audit={statusData?.catalogAudit} />
      <CommercialUpgradeModal
        evaluation={selectedGate}
        locale={locale === 'vi' ? 'vi' : 'en'}
        onClose={() => setSelectedGate(null)}
        onValidateLicenseKey={handleValidateLicensePreview}
        validationFeedback={validationFeedback}
      />
    </div>
  );
}
