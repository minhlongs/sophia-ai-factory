'use client';

/**
 * Interactive Agency Client Onboarding Wizard.
 *
 * Implements a comprehensive 5-step onboarding flow:
 * Step 1: Client Profile (business name, slug, contact, initial MCU)
 * Step 2: Whitelabel Branding (logo, primary/accent colors, CSS with live preview)
 * Step 3: Custom Domain & DNS configuration (CNAME target, SSL readiness)
 * Step 4: Seed Agent Deployment under AGY governance (roles, autonomy, compute limits)
 * Step 5: Review & Launch confirmation with atomic subaccount provisioning
 *
 * Layer: forest/agency (Presentation & Client Component)
 * Allowed imports: react, lucide-react, @/seed/*, @/tree/*, @/land/agency/*
 *
 * @module forest/agency/agency-onboarding-wizard
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import {
  type AgencyOnboardingWizardProps,
  type AgencyOnboardingWizardActions,
  DEFAULT_SEED_AGENTS,
  useWizardState,
  StepIndicator,
  StepProfile,
  StepBranding,
  StepDomain,
  StepSeedAgents,
  StepReviewLaunch,
  WizardControls,
  WizardSuccessView,
} from './onboarding-wizard';

export {
  type AgencyOnboardingWizardProps,
  type AgencyOnboardingWizardActions,
  DEFAULT_SEED_AGENTS,
};

export function AgencyOnboardingWizard({
  agencyOrgId,
  locale = 'vi',
  initialSlug = '',
  actions,
  onSuccess,
}: AgencyOnboardingWizardProps) {
  const isVi = locale === 'vi';

  const {
    currentStep,
    isSubmitting,
    isValidating,
    generalError,
    stepErrors,
    launchResult,
    profile,
    setProfile,
    branding,
    setBranding,
    domain,
    setDomain,
    seedAgents,
    handleClientNameChange,
    handleNextStep,
    handlePrevStep,
    handleToggleAgent,
    handleUpdateAgentAutonomy,
    handleUpdateAgentMcu,
    handleUpdateAgentEscalation,
    handleLaunch,
  } = useWizardState({
    agencyOrgId,
    isVi,
    initialSlug,
    actions,
    onSuccess,
  });

  if (launchResult) {
    return (
      <WizardSuccessView
        launchResult={launchResult}
        profile={profile}
        seedAgents={seedAgents}
        isVi={isVi}
        locale={locale}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Stepper Header */}
      <StepIndicator currentStep={currentStep} isVi={isVi} />

      {/* Errors Banner */}
      {(generalError || stepErrors.length > 0) && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {generalError && <p className="font-semibold">{generalError}</p>}
            {stepErrors.map((err, i) => (
              <p key={i} className="text-xs">
                • {err}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Step Content Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-md">
        {currentStep === 1 && (
          <StepProfile
            profile={profile}
            setProfile={setProfile}
            onClientNameChange={handleClientNameChange}
            isVi={isVi}
          />
        )}

        {currentStep === 2 && (
          <StepBranding
            branding={branding}
            setBranding={setBranding}
            profile={profile}
            isVi={isVi}
          />
        )}

        {currentStep === 3 && (
          <StepDomain
            domain={domain}
            setDomain={setDomain}
            isVi={isVi}
          />
        )}

        {currentStep === 4 && (
          <StepSeedAgents
            seedAgents={seedAgents}
            handleToggleAgent={handleToggleAgent}
            handleUpdateAgentAutonomy={handleUpdateAgentAutonomy}
            handleUpdateAgentMcu={handleUpdateAgentMcu}
            handleUpdateAgentEscalation={handleUpdateAgentEscalation}
            isVi={isVi}
          />
        )}

        {currentStep === 5 && (
          <StepReviewLaunch
            profile={profile}
            branding={branding}
            domain={domain}
            seedAgents={seedAgents}
            isVi={isVi}
          />
        )}

        {/* Wizard Controls Footer */}
        <WizardControls
          currentStep={currentStep}
          isSubmitting={isSubmitting}
          isValidating={isValidating}
          handlePrevStep={handlePrevStep}
          handleNextStep={handleNextStep}
          handleLaunch={handleLaunch}
          isVi={isVi}
        />
      </div>
    </div>
  );
}
