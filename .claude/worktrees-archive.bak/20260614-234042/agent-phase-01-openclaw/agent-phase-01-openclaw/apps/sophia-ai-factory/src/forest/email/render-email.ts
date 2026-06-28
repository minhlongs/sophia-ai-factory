/**
 * Unified email renderer — single entry-point for all templates.
 * Returns {html, text, subject} ready for sender.ts.
 *
 * Templates are split into two camps:
 *  - Lifecycle / handover: welcome-magic-link, onboarding-nudge, first-week-summary, tier-upgrade,
 *    activation-reminder, win-back
 *  - Affiliate: affiliate-welcome, affiliate-day1-tutorial, affiliate-day7-case-study
 *
 * @module lib/email/render-email
 */

import { renderWelcomeMagicLink, type WelcomeMagicLinkData } from './templates/welcome-magic-link';
import { renderOnboardingNudge, type OnboardingNudgeData } from './templates/onboarding-nudge';
import { renderFirstWeekSummary, type FirstWeekSummaryData } from './templates/first-week-summary';
import { renderTierUpgrade, type TierUpgradeData } from './templates/tier-upgrade';
import { renderActivationReminder, type ActivationReminderData } from './templates/activation-reminder';
import { renderSetupComplete, type SetupCompleteData } from './templates/setup-complete';
import { renderToolsNudge, type ToolsNudgeData } from './templates/tools-nudge';
import { renderReEngagementD14, type ReEngagementD14Data } from './templates/re-engagement-d14';
import { renderWinBack, type WinBackData } from './templates/win-back';
import { renderAffiliateWelcome, type AffiliateWelcomeData } from './templates/affiliate-welcome';
import { renderAffiliateDay1Tutorial, type AffiliateDay1Data } from './templates/affiliate-day1-tutorial';
import { renderAffiliateDay7CaseStudy, type AffiliateDay7Data } from './templates/affiliate-day7-case-study';
import { renderPostPurchaseWelcome, type PostPurchaseWelcomeData } from './templates/post-purchase-welcome';
import { renderPostPurchaseNudge, type PostPurchaseNudgeData } from './templates/post-purchase-nudge';
import { renderPostPurchaseFirstSuccess, type PostPurchaseFirstSuccessData } from './templates/post-purchase-first-success';

export type TemplateKey =
  | 'welcome-magic-link'
  | 'onboarding-nudge'
  | 'first-week-summary'
  | 'tier-upgrade'
  | 'activation-reminder'
  | 'setup-complete'
  | 'tools-nudge'
  | 're-engagement-d14'
  | 'win-back'
  | 'affiliate-welcome'
  | 'affiliate-day1-tutorial'
  | 'affiliate-day7-case-study'
  | 'post-purchase-welcome'
  | 'post-purchase-nudge'
  | 'post-purchase-first-success';

export type TemplateDataMap = {
  'welcome-magic-link': WelcomeMagicLinkData;
  'onboarding-nudge': OnboardingNudgeData;
  'first-week-summary': FirstWeekSummaryData;
  'tier-upgrade': TierUpgradeData;
  'activation-reminder': ActivationReminderData;
  'setup-complete': SetupCompleteData;
  'tools-nudge': ToolsNudgeData;
  're-engagement-d14': ReEngagementD14Data;
  'win-back': WinBackData;
  'affiliate-welcome': AffiliateWelcomeData;
  'affiliate-day1-tutorial': AffiliateDay1Data;
  'affiliate-day7-case-study': AffiliateDay7Data;
  'post-purchase-welcome': PostPurchaseWelcomeData;
  'post-purchase-nudge': PostPurchaseNudgeData;
  'post-purchase-first-success': PostPurchaseFirstSuccessData;
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
    case 'activation-reminder':
      return renderActivationReminder(data as ActivationReminderData);
    case 'setup-complete':
      return renderSetupComplete(data as SetupCompleteData);
    case 'tools-nudge':
      return renderToolsNudge(data as ToolsNudgeData);
    case 're-engagement-d14':
      return renderReEngagementD14(data as ReEngagementD14Data);
    case 'win-back':
      return renderWinBack(data as WinBackData);
    case 'affiliate-welcome':
      return renderAffiliateWelcome(data as AffiliateWelcomeData);
    case 'affiliate-day1-tutorial':
      return renderAffiliateDay1Tutorial(data as AffiliateDay1Data);
    case 'affiliate-day7-case-study':
      return renderAffiliateDay7CaseStudy(data as AffiliateDay7Data);
    case 'post-purchase-welcome':
      return renderPostPurchaseWelcome(data as PostPurchaseWelcomeData);
    case 'post-purchase-nudge':
      return renderPostPurchaseNudge(data as PostPurchaseNudgeData);
    case 'post-purchase-first-success':
      return renderPostPurchaseFirstSuccess(data as PostPurchaseFirstSuccessData);
    default: {
      const exhaustive: never = template;
      throw new Error(`Unknown email template: ${exhaustive}`);
    }
  }
}
