/**
 * Agency Onboarding Wizard State Helpers.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/wizard-state-helpers
 */

import { useWizardStateBase } from './use-wizard-state-base';
import { createWizardActions } from './wizard-state-actions';
import { executeWizardNextStep, executeWizardLaunch } from './wizard-step-actions';
import type { AgencyOnboardingWizardActions } from './types';
import type { AgencyOnboardingResult } from '@/seed/types';

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
  const actionsObj = createWizardActions({ agencyOrgId, isVi, actions, onSuccess, baseState });

  return {
    ...baseState,
    ...actionsObj,
  };
}
