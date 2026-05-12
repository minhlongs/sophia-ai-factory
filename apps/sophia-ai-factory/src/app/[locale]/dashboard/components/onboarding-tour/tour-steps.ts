/**
 * Tour step configuration data for OnboardingTourModal.
 * Static array — no React dependency.
 */

export interface StepConfig {
  titleKey: string;
  descKey: string;
  actionKey?: string;
  actionHref?: string;
}

export const STORAGE_KEY = 'sophia_tour_dismissed';
export const TOTAL_STEPS = 7;

export const STEPS: StepConfig[] = [
  { titleKey: 'step1_title', descKey: 'step1_desc' },
  { titleKey: 'step2_title', descKey: 'step2_desc', actionKey: 'step2_action', actionHref: '/dashboard/byok' },
  { titleKey: 'step3_title', descKey: 'step3_desc', actionKey: 'step3_action', actionHref: '/dashboard/sop-marketplace' },
  { titleKey: 'step4_title', descKey: 'step4_desc', actionKey: 'step4_action', actionHref: '/dashboard/sops' },
  { titleKey: 'step5_title', descKey: 'step5_desc', actionKey: 'step5_action', actionHref: '/dashboard/integrations' },
  { titleKey: 'step6_title', descKey: 'step6_desc', actionKey: 'step6_action', actionHref: '/dashboard/credits' },
  { titleKey: 'step7_title', descKey: 'step7_desc', actionKey: 'step7_action', actionHref: '/dashboard/help' },
];
