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
import {
  type AgencyOnboardingWizardProps,
  type AgencyOnboardingWizardActions,
  DEFAULT_SEED_AGENTS,
  useWizardState,
  StepIndicator,
  WizardSuccessView,
} from './onboarding-wizard';
import {
  WizardErrorBanner,
  WizardStepBody,
  type WizardErrorBannerProps,
  type WizardStepBodyProps,
} from './agency-onboarding-wizard-step-body';

export {
  type AgencyOnboardingWizardProps,
  type AgencyOnboardingWizardActions,
  DEFAULT_SEED_AGENTS,
  WizardErrorBanner,
  WizardStepBody,
  type WizardErrorBannerProps,
  type WizardStepBodyProps,
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
      <StepIndicator currentStep={currentStep} isVi={isVi} />
      <WizardErrorBanner generalError={generalError} stepErrors={stepErrors} />
      <WizardStepBody
        currentStep={currentStep}
        isSubmitting={isSubmitting}
        isValidating={isValidating}
        isVi={isVi}
        profile={profile}
        setProfile={setProfile}
        branding={branding}
        setBranding={setBranding}
        domain={domain}
        setDomain={setDomain}
        seedAgents={seedAgents}
        handleClientNameChange={handleClientNameChange}
        handleToggleAgent={handleToggleAgent}
        handleUpdateAgentAutonomy={handleUpdateAgentAutonomy}
        handleUpdateAgentMcu={handleUpdateAgentMcu}
        handleUpdateAgentEscalation={handleUpdateAgentEscalation}
        handlePrevStep={handlePrevStep}
        handleNextStep={handleNextStep}
        handleLaunch={handleLaunch}
      />
    </div>
  );
}
