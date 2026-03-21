/**
 * Self-Serve Onboarding Types
 */

// Onboarding step
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  action?: {
    type: 'navigate' | 'modal' | 'external';
    target: string;
  };
}

// Onboarding checklist state
export interface OnboardingChecklist {
  userId: string;
  orgId: string;
  steps: OnboardingStep[];
  progress: number; // 0-100
  startedAt: string;
  completedAt?: string;
}

// Email sequence
export interface EmailSequence {
  id: string;
  name: string;
  trigger: 'signup' | 'trial_start' | 'trial_end' | 'day_7';
  delayHours: number;
  subject: string;
  templateId: string;
  status: 'draft' | 'active' | 'paused';
}

// Welcome email
export interface WelcomeEmail {
  to: string;
  template: 'day_0' | 'day_1' | 'day_3' | 'day_5' | 'day_7';
  variables: Record<string, string>;
}

// Onboarding progress event
export interface OnboardingEvent {
  userId: string;
  orgId: string;
  stepId: string;
  action: 'started' | 'completed' | 'skipped';
  timestamp: string;
}
