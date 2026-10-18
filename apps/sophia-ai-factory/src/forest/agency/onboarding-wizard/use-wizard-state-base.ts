/**
 * Base state hook for Agency Onboarding Wizard.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/use-wizard-state-base
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
import { DEFAULT_SEED_AGENTS } from './types';
import {
  createInitialAgencyProfile,
  createInitialAgencyBranding,
  createInitialAgencyDomain,
  toAgencySlug,
  createSeedAgentUpdaters,
} from './wizard-state-util';

export interface UseWizardStateBaseParams {
  initialSlug?: string;
}

export function useWizardStateBase({ initialSlug = '' }: UseWizardStateBaseParams) {
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

  return {
    currentStep,
    setCurrentStep,
    isSubmitting,
    setIsSubmitting,
    isValidating,
    setIsValidating,
    generalError,
    setGeneralError,
    stepErrors,
    setStepErrors,
    launchResult,
    setLaunchResult,
    profile,
    setProfile,
    branding,
    setBranding,
    domain,
    setDomain,
    seedAgents,
    setSeedAgents,
    handleClientNameChange,
    ...createSeedAgentUpdaters(setSeedAgents),
  };
}