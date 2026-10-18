/**
 * Types & Constants for 6-Step Pilot Onboarding Readiness Tracker
 *
 * Layer: tree/open-core
 * @module tree/open-core/pilot-onboarding-types
 */

export type PilotStepKey =
  | 'landing_locale_verified'
  | 'byok_wizard_completed'
  | 'telegram_bot_linked'
  | 'payment_webhook_confirmed'
  | 'd1_tier_activated'
  | 'social_publishing_scheduled';

export type PilotPaymentProvider = 'nowpayments' | 'payos';
export type CanonicalPilotTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface PilotStepRecord {
  readonly stepKey: PilotStepKey;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly completedAt?: string;
  readonly defectIssueUrl?: string;
  readonly notes?: string;
}

export interface PilotJourneyState {
  readonly customerId: string;
  readonly liveEdgeShortSha: string;
  readonly paymentProvider: string;
  readonly activatedTier: CanonicalPilotTier;
  readonly byokEncryptedInD1: boolean;
  readonly configuredProviders: readonly string[];
  readonly steps: readonly PilotStepRecord[];
}

export interface PilotReadinessReport {
  readonly customerId: string;
  readonly liveEdgeShortSha: string;
  readonly paymentProvider: PilotPaymentProvider;
  readonly activatedTier: CanonicalPilotTier;
  readonly completionPercentage: number;
  readonly passedSteps: readonly PilotStepKey[];
  readonly failedSteps: readonly PilotStepKey[];
  readonly zeroDefectVerified: boolean;
  readonly attestationSignatureHex: string;
}

export const MANDATORY_PILOT_STEPS: readonly PilotStepKey[] = [
  'landing_locale_verified',
  'byok_wizard_completed',
  'telegram_bot_linked',
  'payment_webhook_confirmed',
  'd1_tier_activated',
  'social_publishing_scheduled',
];
