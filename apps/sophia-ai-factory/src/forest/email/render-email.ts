/**
 * Unified email renderer — single entry-point for all templates.
 * Returns {html, text, subject} ready for sender.ts.
 * @module lib/email/render-email
 */

import { renderWelcomeMagicLink, type WelcomeMagicLinkData } from './templates/welcome-magic-link';
import { renderOnboardingNudge, type OnboardingNudgeData } from './templates/onboarding-nudge';
import { renderFirstWeekSummary, type FirstWeekSummaryData } from './templates/first-week-summary';
import { renderTierUpgrade, type TierUpgradeData } from './templates/tier-upgrade';

export type TemplateKey = 'welcome-magic-link' | 'onboarding-nudge' | 'first-week-summary' | 'tier-upgrade';

export type TemplateDataMap = {
  'welcome-magic-link': WelcomeMagicLinkData;
  'onboarding-nudge': OnboardingNudgeData;
  'first-week-summary': FirstWeekSummaryData;
  'tier-upgrade': TierUpgradeData;
};

export interface RenderEmailResult {
  html: string;
  text: string;
  subject: string;
}

export function renderEmail<K extends TemplateKey>(
  template: K,
  data: TemplateDataMap[K],
): RenderEmailResult {
  switch (template) {
    case 'welcome-magic-link':
      return renderWelcomeMagicLink(data as WelcomeMagicLinkData);
    case 'onboarding-nudge':
      return renderOnboardingNudge(data as OnboardingNudgeData);
    case 'first-week-summary':
      return renderFirstWeekSummary(data as FirstWeekSummaryData);
    case 'tier-upgrade':
      return renderTierUpgrade(data as TierUpgradeData);
    default: {
      const exhaustive: never = template;
      throw new Error(`Unknown email template: ${exhaustive}`);
    }
  }
}
