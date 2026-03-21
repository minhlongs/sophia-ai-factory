/**
 * Onboarding Checklist Configuration
 */

import type { OnboardingStep } from '@/types/onboarding';

export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'create_org',
    title: 'Create Organization',
    description: 'Set up your organization profile',
    icon: 'building',
    completed: false,
    action: {
      type: 'navigate',
      target: '/onboarding',
    },
  },
  {
    id: 'invite_team',
    title: 'Invite Team Members',
    description: 'Add your team to collaborate',
    icon: 'users',
    completed: false,
    action: {
      type: 'navigate',
      target: '/settings/team',
    },
  },
  {
    id: 'select_template',
    title: 'Choose a Template',
    description: 'Select a proposal template for your agency',
    icon: 'template',
    completed: false,
    action: {
      type: 'navigate',
      target: '/templates',
    },
  },
  {
    id: 'generate_proposal',
    title: 'Generate First Proposal',
    description: 'Create your first AI-powered proposal',
    icon: 'document',
    completed: false,
    action: {
      type: 'navigate',
      target: '/proposals/new',
    },
  },
  {
    id: 'add_video',
    title: 'Add Video Pitch',
    description: 'Enhance your proposal with AI video',
    icon: 'video',
    completed: false,
    action: {
      type: 'navigate',
      target: '/proposals/new?video=true',
    },
  },
  {
    id: 'connect_crm',
    title: 'Connect CRM',
    description: 'Sync with HubSpot for better tracking',
    icon: 'crm',
    completed: false,
    action: {
      type: 'navigate',
      target: '/settings/crm',
    },
  },
  {
    id: 'review_analytics',
    title: 'View Analytics',
    description: 'Track your proposal performance',
    icon: 'chart',
    completed: false,
    action: {
      type: 'navigate',
      target: '/analytics',
    },
  },
];

export const WELCOME_EMAIL_SEQUENCE = [
  {
    day: 0,
    subject: 'Welcome to Sophia AI Factory! 🎉',
    template: 'day_0',
  },
  {
    day: 1,
    subject: 'Your first proposal in 30 seconds',
    template: 'day_1',
  },
  {
    day: 3,
    subject: 'How [Agency X] won $500K with Sophia',
    template: 'day_3',
  },
  {
    day: 5,
    subject: 'Quick Win: Try Video Proposals',
    template: 'day_5',
  },
  {
    day: 7,
    subject: "How's it going? + NPS Survey",
    template: 'day_7',
  },
];

export function calculateProgress(steps: OnboardingStep[]): number {
  const completed = steps.filter((s) => s.completed).length;
  return Math.round((completed / steps.length) * 100);
}

export function getNextStep(steps: OnboardingStep[]): OnboardingStep | null {
  return steps.find((s) => !s.completed) || null;
}
