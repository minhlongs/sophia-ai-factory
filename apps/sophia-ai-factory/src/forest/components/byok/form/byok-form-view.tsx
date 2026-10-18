'use client';

// i18n-namespace: byok

import type { ByokKeyFormProps } from './types';
import {
  ByokStatusBanner,
  ByokProviderGrid,
  saveByokProviderKey,
  testByokProviderKey,
  deleteByokProviderKey,
  type ByokStatusBannerProps,
  type ByokProviderGridProps,
} from './byok-form-sections';
import { useByokForm } from './use-byok-form';

export {
  ByokStatusBanner,
  ByokProviderGrid,
  saveByokProviderKey,
  testByokProviderKey,
  deleteByokProviderKey,
  useByokForm,
  type ByokStatusBannerProps,
  type ByokProviderGridProps,
};

export function ByokFormView({ configured: initialConfigured }: ByokKeyFormProps) {
  const {
    configured,
    status,
    setStatus,
    isPending,
    testResults,
    testingProvider,
    keyInputs,
    editingProviders,
    validations,
    handleInputChange,
    toggleEditing,
    handleTest,
    handleSingleSubmit,
    handleClear,
  } = useByokForm(initialConfigured);

  return (
    <div className="space-y-6">
      <ByokStatusBanner status={status} onDismiss={() => setStatus(null)} />
      <ByokProviderGrid
        configured={configured}
        editingProviders={editingProviders}
        isPending={isPending}
        keyInputs={keyInputs}
        testResults={testResults}
        testingProvider={testingProvider}
        validations={validations}
        onInputChange={handleInputChange}
        onToggleEditing={toggleEditing}
        onSubmit={handleSingleSubmit}
        onTest={handleTest}
        onClear={handleClear}
      />
    </div>
  );
}
