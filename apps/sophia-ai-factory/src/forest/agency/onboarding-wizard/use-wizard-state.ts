/**
 * Agency Onboarding Wizard State Hook.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/use-wizard-state
 */

import { useState } from 'react';
import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import { DEFAULT_SEED_AGENTS, type AgencyOnboardingWizardActions } from './types';
import { runStepValidation } from './validate-wizard-step';
import {
  createInitialAgencyProfile,
  createInitialAgencyBranding,
  createInitialAgencyDomain,
  toAgencySlug,
  createSeedAgentUpdaters,
} from './wizard-state-helpers';

interface UseWizardStateParams {
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
  const [branding, setBranding] = useState<AgencyBrandingInput>(
    createInitialAgencyBranding,
  );
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

  const handleNextStep = async () => {
    setIsValidating(true);
    setGeneralError(null);
    setStepErrors([]);
    try {
      const res = await runStepValidation({
        currentStep,
        profile,
        branding,
        domain,
        seedAgents,
        actions,
      });
      if (!res.valid) {
        setStepErrors(res.errors);
        return;
      }
      if (currentStep < 5) {
        setCurrentStep((prev) => (prev + 1) as AgencyOnboardingStep);
      }
    } catch {
      setGeneralError(
        isVi ? 'Đã có lỗi xảy ra khi xác thực bước này.' : 'Error validating step data.',
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setGeneralError(null);
      setStepErrors([]);
      setCurrentStep((prev) => (prev - 1) as AgencyOnboardingStep);
    }
  };

  const agentUpdaters = createSeedAgentUpdaters(setSeedAgents);

  const handleLaunch = async () => {
    setIsSubmitting(true);
    setGeneralError(null);
    setStepErrors([]);
    const submission: AgencyOnboardingSubmission = {
      agencyOrgId,
      profile,
      branding,
      domain,
      seedAgents,
    };
    try {
      if (!actions?.submitOnboarding) {
        setGeneralError(
          isVi
            ? 'Hành động kích hoạt không gian chưa được cấu hình.'
            : 'Submit action not provided.',
        );
        return;
      }
      const res = await actions.submitOnboarding(submission);
      if (!res.success) {
        setGeneralError(
          res.error || (isVi ? 'Không thể hoàn tất khởi tạo.' : 'Submission failed.'),
        );
        if (res.stepErrors) setStepErrors(Object.values(res.stepErrors).flat());
        return;
      }
      setLaunchResult(res);
      if (onSuccess) onSuccess(res);
    } catch {
      setGeneralError(
        isVi
          ? 'Lỗi máy chủ trong quá trình kích hoạt không gian.'
          : 'Server error during workspace provisioning.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
    ...agentUpdaters,
    handleLaunch,
  };
}
