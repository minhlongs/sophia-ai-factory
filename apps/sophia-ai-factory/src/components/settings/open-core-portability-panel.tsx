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

import React from 'react';
import { useLocale } from 'next-intl';
import { CommercialUpgradeModal } from '@/components/open-core/commercial-upgrade-modal';
import { OpenCoreBlueprintMatrix } from './open-core-blueprint-matrix';
import {
  FeaturesMatrixView,
  PortabilityBoxView,
} from './open-core-portability-subviews';
import { useOpenCorePortability } from './use-open-core-portability';

export function OpenCorePortabilityPanel() {
  const locale = useLocale();
  const {
    statusData,
    selectedGate,
    setSelectedGate,
    validationFeedback,
    setValidationFeedback,
    bundleJson,
    setBundleJson,
    notice,
    isBusy,
    handleValidateLicensePreview,
    handleExportWorkspace,
    handleImportWorkspace,
  } = useOpenCorePortability();

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
