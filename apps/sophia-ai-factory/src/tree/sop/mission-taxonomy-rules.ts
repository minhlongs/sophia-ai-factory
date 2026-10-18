/**
 * Mission Taxonomy & Auto-Dispatch Fleet Rules
 *
 * Layer: tree/sop (domain-reusable)
 */

export type MissionType =
  | 'content'
  | 'video'
  | 'social'
  | 'support'
  | 'finance'
  | 'sales'
  | 'onboarding'
  | 'engineering'
  | 'marketing'
  | 'unknown';

export interface MissionTypeRule {
  missionType: MissionType;
  keywords: string[];
  agentFleet: string[];
}

export const RULES: MissionTypeRule[] = [
  {
    keywords: ['post', 'blog', 'article', 'newsletter', 'copy', 'seo', 'email campaign'],
    agentFleet: ['copywriter', 'seo-reviewer'],
    missionType: 'content',
  },
  {
    keywords: ['video', 'render', 'avatar', 'voiceover', 'caption', 'subtitle'],
    agentFleet: ['video-producer', 'captioner', 'quality-checker'],
    missionType: 'video',
  },
  {
    keywords: ['social', 'tiktok', 'instagram', 'linkedin', 'twitter', 'engagement'],
    agentFleet: ['social-manager', 'copywriter'],
    missionType: 'social',
  },
  {
    keywords: ['support', 'ticket', 'complaint', 'refund', 'helpdesk', 'customer'],
    agentFleet: ['support-agent', 'sentinel'],
    missionType: 'support',
  },
  {
    keywords: ['invoice', 'revenue', 'billing', 'tax', 'expense', 'payroll'],
    agentFleet: ['finance-clerk', 'auditor'],
    missionType: 'finance',
  },
  {
    keywords: ['proposal', 'outreach', 'cold email', 'meeting', 'deal', 'pipeline'],
    agentFleet: ['sales-writer', 'scheduler'],
    missionType: 'sales',
  },
  {
    keywords: ['onboard', 'new client', 'setup', 'kickoff', 'welcome'],
    agentFleet: ['onboarding-coordinator'],
    missionType: 'onboarding',
  },
  {
    keywords: ['deploy', 'migrate', 'fix', 'bug', 'incident', 'ci/cd', 'infrastructure'],
    agentFleet: ['devops-engineer', 'qa-tester'],
    missionType: 'engineering',
  },
  {
    keywords: ['campaign', 'ads', 'cac', 'growth', 'channel', 'acquisition', 'referral'],
    agentFleet: ['growth-hacker', 'analyst'],
    missionType: 'marketing',
  },
];

/**
 * Returns a fleet spec when the mission can be dispatched without human input.
 */
export function getDispatchRule(missionType: MissionType): MissionTypeRule | undefined {
  return RULES.find((r) => r.missionType === missionType);
}
