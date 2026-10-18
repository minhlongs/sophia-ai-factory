/**
 * Alert Rule Evaluator Types and Default Configurations
 *
 * @module alerts/quota/alert-rule-types
 */

import type { Tier } from '@/seed/types';

export type AlertSeverity = 'warning' | 'critical' | 'info';
export type AlertChannel = 'email' | 'sms' | 'webhook';
export type AlertThreshold = 80 | 90 | 100;

export interface QuotaAlertContext {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  threshold: AlertThreshold;
  currentUsage: number;
  limit: number;
  percentage: number;
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  stripeCustomerId?: string;
  ipAddress?: string;
}

export interface AlertTemplate {
  subject: string;
  body: string;
  htmlBody?: string;
  smsBody?: string;
}

export interface AlertConfig {
  enabledChannels: AlertChannel[];
  rateLimitWindowSeconds: number;
  includeBillingLink: boolean;
  upgradePrompt: boolean;
}

export interface AlertDeliveryResult {
  success: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  webhookSent?: boolean;
  error?: string;
  rateLimited?: boolean;
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabledChannels: ['email', 'sms'],
  rateLimitWindowSeconds: 3600,
  includeBillingLink: true,
  upgradePrompt: true,
};

export const TIER_ALERT_CONFIGS: Record<Tier, AlertConfig> = {
  BASIC:      { ...DEFAULT_ALERT_CONFIG, enabledChannels: ['email'], upgradePrompt: true },
  PREMIUM:    { ...DEFAULT_ALERT_CONFIG, enabledChannels: ['email', 'sms'], upgradePrompt: true },
  ENTERPRISE: { ...DEFAULT_ALERT_CONFIG, rateLimitWindowSeconds: 1800, upgradePrompt: false },
  MASTER:     { ...DEFAULT_ALERT_CONFIG, rateLimitWindowSeconds: 900, upgradePrompt: false },
};
