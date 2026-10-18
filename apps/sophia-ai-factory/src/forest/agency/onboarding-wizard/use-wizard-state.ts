/**
 * Agency Onboarding Wizard State Hook.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/use-wizard-state
 */

import type {
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import { DEFAULT_SEED_AGENTS, type AgencyOnboardingWizardActions } from './types';
import { useWizardStateBase } from './use-wizard-state-base';
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
  const baseState = useWizardStateBase({ initialSlug });

  const handleNextStep = () =>
    executeWizardNextStep({
      currentStep: baseState.currentStep,
      isVi,
      profile: baseState.profile,
      branding: baseState.branding,
      domain: baseState.domain,
      seedAgents: baseState.seedAgents,
      actions,
      setIsValidating: baseState.setIsValidating,
      setGeneralError: baseState.setGeneralError,
      setStepErrors: baseState.setStepErrors,
      setCurrentStep: baseState.setCurrentStep,
    });

  const handlePrevStep = () => {
    if (baseState.currentStep > 1) {
      baseState.setGeneralError(null);
      baseState.setStepErrors([]);
      baseState.setCurrentStep((prev) => (prev - 1) as AgencyOnboardingStep);
    }
  };

  const handleLaunch = () =>
    executeWizardLaunch({
      agencyOrgId,
      isVi,
      profile: baseState.profile,
      branding: baseState.branding,
      domain: baseState.domain,
      seedAgents: baseState.seedAgents,
      actions,
      onSuccess,
      setIsSubmitting: baseState.setIsSubmitting,
      setGeneralError: baseState.setGeneralError,
      setStepErrors: baseState.setStepErrors,
      setLaunchResult: baseState.setLaunchResult,
    });

  return {
    ...baseState,
    handleNextStep,
    handlePrevStep,
    handleLaunch,
  };
}