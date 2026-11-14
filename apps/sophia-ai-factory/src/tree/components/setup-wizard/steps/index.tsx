"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { WelcomeStep } from './welcome-step';
import { AccountStep } from './account-step';
import { ApiKeysStep } from './api-keys-step';
import { PaymentStep } from './payment-step';
import { FirstMissionStep } from './first-mission-step';
import { FinishStep } from './finish-step';
import { WizardStepper } from '@/tree/components/setup-wizard/wizard-stepper';
import { ByokDoctrineBanner } from '@/tree/components/setup-wizard/byok-doctrine-banner';
import { useSetupWizard, KEY_TO_PROVIDER } from './use-setup-wizard';

const TOTAL_STEPS = 6;

export function SetupWizardPage() {
  const tStepper = useTranslations('setupWizard.stepper');
  const steps = useMemo(
    () => [
      tStepper('welcome'),
      tStepper('account'),
      tStepper('aiKeys'),
      tStepper('billing'),
      tStepper('blueprint'),
      tStepper('ready'),
    ],
    [tStepper],
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const {
    accountEmail,
    isOwner,
    currentTier,
    mcuBalance,
    subscriptionStatus,
    savedProviders,
    revokingProvider,
    config,
    updateConfig,
    verifyKey,
    handleRevokeProvider,
    handleSave,
    status,
    errors,
    latencies,
    saveError,
    saveFailed,
    isSaving,
  } = useSetupWizard();

  const handleNext = useCallback(async () => {
    if (currentStepIndex === 2) {
      const hasInvalidKeys = Object.entries(config).some(
        ([k, v]) => KEY_TO_PROVIDER[k] && v.trim() && status[k] === 'invalid'
      );
      if (hasInvalidKeys) {
        return;
      }

      const hasPendingKeys = Object.entries(config).some(
        ([k, v]) => KEY_TO_PROVIDER[k] && v.trim()
      );
      if (hasPendingKeys) {
        const saved = await handleSave();
        if (!saved) return;
      }
    } else if (currentStepIndex === 4) {
      const saved = await handleSave();
      if (!saved) return; // FAIL-CLOSED
    }
    if (currentStepIndex < TOTAL_STEPS - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, config, status, handleSave]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) setCurrentStepIndex((prev) => prev - 1);
  }, [currentStepIndex]);

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-3xl mx-auto space-y-6">
        <WizardStepper currentStep={currentStepIndex + 1} steps={steps} />
        <ByokDoctrineBanner />
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xs">
          {currentStepIndex === 0 && <WelcomeStep onNext={handleNext} />}
          {currentStepIndex === 1 && (
            <AccountStep
              onNext={handleNext}
              onBack={handleBack}
              accountEmail={accountEmail}
              isOwner={isOwner}
            />
          )}
          {currentStepIndex === 2 && (
            <ApiKeysStep
              config={config}
              updateConfig={updateConfig}
              verifyKey={verifyKey}
              status={status}
              errors={errors}
              latencies={latencies}
              savedProviders={savedProviders}
              onRevokeProvider={handleRevokeProvider}
              revokingProvider={revokingProvider}
              saveError={saveError}
              isSaving={isSaving}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStepIndex === 3 && (
            <PaymentStep
              onNext={handleNext}
              onBack={handleBack}
              currentTier={currentTier}
              mcuBalance={mcuBalance}
              subscriptionStatus={subscriptionStatus}
            />
          )}
          {currentStepIndex === 4 && (
            <FirstMissionStep
              onNext={handleNext}
              onBack={handleBack}
              saveError={saveError}
              isSaving={isSaving}
            />
          )}
          {currentStepIndex === 5 && (
            <FinishStep
              saveError={saveError}
              saveFailed={saveFailed}
              onRetry={handleSave}
              onNavigateToStep={setCurrentStepIndex}
            />
          )}
        </div>
      </div>
    </div>
  );
}
