/**
 * Action handlers for Agency Onboarding Wizard.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/wizard-state-actions
 */

import type {
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import { DEFAULT_SEED_AGENTS } from './types';
import type { AgencyOnboardingWizardActions } from './types';
import { executeWizardNextStep, executeWizardLaunch } from './wizard-step-actions';
import {
  createInitialAgencyProfile,
  createInitialAgencyBranding,
  createInitialAgencyDomain,
  toAgencySlug,
  createSeedAgentUpdaters,
} from './wizard-state-util';

type BaseState = {
  currentStep: AgencyOnboardingStep;
  setCurrentStep: React.Dispatch<React.SetStateAction<AgencyOnboardingStep>>;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
  isValidating: boolean;
  setIsValidating: (val: boolean) => void;
  generalError: string | null;
  setGeneralError: (err: string | null) => void;
  stepErrors: string[];
  setStepErrors: (errs: string[]) => void;
  launchResult: AgencyOnboardingResult | null;
  setLaunchResult: (res: AgencyOnboardingResult | null) => void;
  profile: AgencyProfileInput;
  setProfile: (p: AgencyProfileInput) => void;
  branding: AgencyBrandingInput;
  setBranding: (b: AgencyBrandingInput) => void;
  domain: AgencyDomainInput;
  setDomain: (d: AgencyDomainInput) => void;
  seedAgents: SeedAgentDeploymentConfig[];
  setSeedAgents: (s: SeedAgentDeploymentConfig[]) => void;
  handleClientNameChange: (name: string) => void;
};

export function createWizardActions(props: {
  agencyOrgId: string;
  isVi: boolean;
  actions?: AgencyOnboardingWizardActions;
  onSuccess?: (result: AgencyOnboardingResult) => void;
  baseState: BaseState;
}) {
  const handleNextStep = () =>
    executeWizardNextStep({
      currentStep: props.baseState.currentStep,
      isVi: props.isVi,
      profile: props.baseState.profile,
      branding: props.baseState.branding,
      domain: props.baseState.domain,
      seedAgents: props.baseState.seedAgents,
      actions: props.actions,
      setIsValidating: props.baseState.setIsValidating,
      setGeneralError: props.baseState.setGeneralError,
      setStepErrors: props.baseState.setStepErrors,
      setCurrentStep: props.baseState.setCurrentStep,
    });

  const handlePrevStep = () => {
    if (props.baseState.currentStep > 1) {
      props.baseState.setGeneralError(null);
      props.baseState.setStepErrors([]);
      props.baseState.setCurrentStep((prev) => (prev - 1) as AgencyOnboardingStep);
    }
  };

  const handleLaunch = () =>
    executeWizardLaunch({
      agencyOrgId: props.agencyOrgId,
      isVi: props.isVi,
      profile: props.baseState.profile,
      branding: props.baseState.branding,
      domain: props.baseState.domain,
      seedAgents: props.baseState.seedAgents,
      actions: props.actions,
      onSuccess: props.onSuccess,
      setIsSubmitting: props.baseState.setIsSubmitting,
      setGeneralError: props.baseState.setGeneralError,
      setStepErrors: props.baseState.setStepErrors,
      setLaunchResult: props.baseState.setLaunchResult,
    });

  return {
    handleNextStep,
    handlePrevStep,
    handleLaunch,
  };
}
