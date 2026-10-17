/**
 * Agency Onboarding Wizard — Step Advancement & Launch Execution Helpers.
 * @module forest/agency/onboarding-wizard/wizard-step-actions
 */

import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import type { AgencyOnboardingWizardActions } from './types';
import { runStepValidation } from './validate-wizard-step';

export interface ExecuteWizardNextStepParams {
  currentStep: AgencyOnboardingStep;
  isVi: boolean;
  profile: AgencyProfileInput;
  branding: AgencyBrandingInput;
  domain: AgencyDomainInput;
  seedAgents: SeedAgentDeploymentConfig[];
  actions?: AgencyOnboardingWizardActions;
  setIsValidating: (v: boolean) => void;
  setGeneralError: (err: string | null) => void;
  setStepErrors: (errs: string[]) => void;
  setCurrentStep: React.Dispatch<React.SetStateAction<AgencyOnboardingStep>>;
}

export async function executeWizardNextStep(
  params: ExecuteWizardNextStepParams,
): Promise<void> {
  const { currentStep, isVi, setIsValidating, setGeneralError, setStepErrors, setCurrentStep } = params;
  setIsValidating(true);
  setGeneralError(null);
  setStepErrors([]);
  try {
    const res = await runStepValidation(params);
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
}

export interface ExecuteWizardLaunchParams {
  agencyOrgId: string;
  isVi: boolean;
  profile: AgencyProfileInput;
  branding: AgencyBrandingInput;
  domain: AgencyDomainInput;
  seedAgents: SeedAgentDeploymentConfig[];
  actions?: AgencyOnboardingWizardActions;
  onSuccess?: (result: AgencyOnboardingResult) => void;
  setIsSubmitting: (v: boolean) => void;
  setGeneralError: (err: string | null) => void;
  setStepErrors: (errs: string[]) => void;
  setLaunchResult: (res: AgencyOnboardingResult | null) => void;
}

export async function executeWizardLaunch(
  params: ExecuteWizardLaunchParams,
): Promise<void> {
  const {
    agencyOrgId, isVi, profile, branding, domain, seedAgents,
    actions, onSuccess, setIsSubmitting, setGeneralError, setStepErrors, setLaunchResult,
  } = params;
  setIsSubmitting(true);
  setGeneralError(null);
  setStepErrors([]);
  const submission: AgencyOnboardingSubmission = {
    agencyOrgId, profile, branding, domain, seedAgents,
  };
  try {
    if (!actions?.submitOnboarding) {
      setGeneralError(
        isVi ? 'Hành động kích hoạt không gian chưa được cấu hình.' : 'Submit action not provided.',
      );
      return;
    }
    const res = await actions.submitOnboarding(submission);
    if (!res.success) {
      setGeneralError(res.error || (isVi ? 'Không thể hoàn tất khởi tạo.' : 'Submission failed.'));
      if (res.stepErrors) setStepErrors(Object.values(res.stepErrors).flat());
      return;
    }
    setLaunchResult(res);
    if (onSuccess) onSuccess(res);
  } catch {
    setGeneralError(
      isVi ? 'Lỗi máy chủ trong quá trình kích hoạt không gian.' : 'Server error during workspace provisioning.',
    );
  } finally {
    setIsSubmitting(false);
  }
}
