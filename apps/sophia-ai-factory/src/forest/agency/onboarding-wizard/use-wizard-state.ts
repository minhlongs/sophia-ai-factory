/**
 * Agency Onboarding Wizard State Hook.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/use-wizard-state
 */

import { useState } from 'react';
import type {
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import { DEFAULT_SEED_AGENTS, type AgencyOnboardingWizardActions } from './types';
import {
  createInitialAgencyProfile,
  createInitialAgencyBranding,
  createInitialAgencyDomain,
  toAgencySlug,
  createSeedAgentUpdaters,
} from './wizard-state-helpers';
import { executeWizardNextStep, executeWizardLaunch } from './wizard-step-actions';

export { executeWizardNextStep, executeWizardLaunch };

export interface UseWizardStateParams {
  agencyOrgId: string;
  isVi: boolean;
  initialSlug?: string;
  actions?: AgencyOnboardingWizardActions;
  onSuccess?: (result: AgencyOnboardingResult) => void;
}

export function useWizardState({
  agencyOrgId,
  isVi,
  initialSlug = '',
  actions,
  onSuccess,
}: UseWizardStateParams) {
  const [currentStep, setCurrentStep] = useState<AgencyOnboardingStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [launchResult, setLaunchResult] = useState<AgencyOnboardingResult | null>(null);

  const [profile, setProfile] = useState<AgencyProfileInput>(() =>
    createInitialAgencyProfile(initialSlug),
  );
  const [branding, setBranding] = useState<AgencyBrandingInput>(createInitialAgencyBranding);
  const [domain, setDomain] = useState<AgencyDomainInput>(() =>
    createInitialAgencyDomain(initialSlug),
  );
  const [seedAgents, setSeedAgents] =
    useState<SeedAgentDeploymentConfig[]>(DEFAULT_SEED_AGENTS);

  const handleClientNameChange = (name: string) => {
    const slug = toAgencySlug(name);
    setProfile((prev) => ({
      ...prev,
      clientName: name,
      agencySlug: prev.agencySlug ? prev.agencySlug : slug,
    }));
    if (!domain.subdomain) {
      setDomain((prev) => ({ ...prev, subdomain: slug }));
    }
  };

  const handleNextStep = () =>
    executeWizardNextStep({
      currentStep,
      isVi,
      profile,
      branding,
      domain,
      seedAgents,
      actions,
      setIsValidating,
      setGeneralError,
      setStepErrors,
      setCurrentStep,
    });

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setGeneralError(null);
      setStepErrors([]);
      setCurrentStep((prev) => (prev - 1) as AgencyOnboardingStep);
    }
  };

  const handleLaunch = () =>
    executeWizardLaunch({
      agencyOrgId,
      isVi,
      profile,
      branding,
      domain,
      seedAgents,
      actions,
      onSuccess,
      setIsSubmitting,
      setGeneralError,
      setStepErrors,
      setLaunchResult,
    });

  return {
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
    ...createSeedAgentUpdaters(setSeedAgents),
    handleLaunch,
  };
}
