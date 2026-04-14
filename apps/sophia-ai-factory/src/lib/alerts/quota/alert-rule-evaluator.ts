/**
 * Alert Rule Evaluator
 *
 * Evaluates quota thresholds, builds alert templates, and checks rate limits.
 * Determines which alerts to fire based on current usage percentages.
 *
 * @module alerts/quota/alert-rule-evaluator
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

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
  polarCustomerId?: string;
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

// -------------------------------------------------------------------------
// Template building
// -------------------------------------------------------------------------

/**
 * Build email HTML template for quota alert (80% threshold)
 */
function buildEmailHtml80(context: QuotaAlertContext): string {
  const { percentage, currentUsage, limit, tier } = context;
  const tierDisplay = tier.charAt(0) + tier.slice(1).toLowerCase();
  const usageType = context.exceededType.replace('_', ' ');
  const billingUrl = '/dashboard/billing';
  const upgradeUrl = '/dashboard/billing?action=upgrade';

  return `
<!DOCTYPE html><html><head><style>
  body { font-family: -apple-system, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
  .usage-bar { background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin: 20px 0; }
  .usage-fill { background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%); height: 100%; width: ${percentage}%; }
  .stats { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
  .stat-row:last-child { border-bottom: none; }
  .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; }
  .button-secondary { background: #6b7280; }
</style></head><body>
<div class="container">
  <div class="header"><h1>⚠️ Usage Alert</h1><p>You've used ${percentage.toFixed(0)}% of your ${tierDisplay} plan</p></div>
  <div class="content">
    <div class="usage-bar"><div class="usage-fill"></div></div>
    <div class="stats">
      <div class="stat-row"><span><strong>${usageType}</strong></span><span>${currentUsage.toLocaleString()} / ${limit.toLocaleString()}</span></div>
      <div class="stat-row"><span><strong>Usage Percentage</strong></span><span>${percentage.toFixed(1)}%</span></div>
      <div class="stat-row"><span><strong>Plan Tier</strong></span><span>${tierDisplay}</span></div>
    </div>
    <p>We're notifying you to avoid any service interruption.</p>
    <div style="margin-top: 20px;">
      <a href="${billingUrl}" class="button">View Dashboard</a>
      ${TIER_ALERT_CONFIGS[tier].upgradePrompt ? `<a href="${upgradeUrl}" class="button button-secondary">Upgrade Plan</a>` : ''}
    </div>
  </div>
</div></body></html>`;
}

/**
 * Build email HTML template for quota alert (90% threshold)
 */
function buildEmailHtml90(context: QuotaAlertContext): string {
  const { percentage, currentUsage, limit } = context;
  const usageType = context.exceededType.replace('_', ' ');
  const upgradeUrl = '/dashboard/billing?action=upgrade';
  const billingUrl = '/dashboard/billing';

  return `
<!DOCTYPE html><html><head><style>
  body { font-family: -apple-system, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
  .usage-bar { background: #fee2e2; height: 20px; border-radius: 10px; overflow: hidden; margin: 20px 0; }
  .usage-fill { background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); height: 100%; width: ${percentage}%; }
  .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  .stats { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
  .stat-row:last-child { border-bottom: none; }
  .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; }
  .button-secondary { background: #6b7280; }
</style></head><body>
<div class="container">
  <div class="header"><h1>🚨 Urgent Alert</h1><p>Action Required: ${percentage.toFixed(0)}% of plan used</p></div>
  <div class="content">
    <div class="warning-box"><strong>⚠️ Service may be restricted soon</strong><p>Your usage is at ${percentage.toFixed(1)}%.</p></div>
    <div class="usage-bar"><div class="usage-fill"></div></div>
    <div class="stats">
      <div class="stat-row"><span><strong>${usageType}</strong></span><span>${currentUsage.toLocaleString()} / ${limit.toLocaleString()}</span></div>
      <div class="stat-row"><span><strong>Remaining</strong></span><span>${(limit - currentUsage).toLocaleString()}</span></div>
    </div>
    <div style="margin-top: 20px;">
      <a href="${upgradeUrl}" class="button">Upgrade Now</a>
      <a href="${billingUrl}" class="button button-secondary">View Dashboard</a>
    </div>
  </div>
</div></body></html>`;
}

/**
 * Build email HTML template for quota alert (100% threshold)
 */
function buildEmailHtml100(): string {
  const upgradeUrl = '/dashboard/billing?action=upgrade';

  return `
<!DOCTYPE html><html><head><style>
  body { font-family: -apple-system, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #000000 0%, #1f2937 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
  .critical-box { background: #fee2e2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
  .status-badge { display: inline-block; background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
  .button { display: inline-block; background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 10px 0; font-size: 18px; }
</style></head><body>
<div class="container">
  <div class="header"><h1>🚫 Service Restricted</h1><p>Your plan limit has been exceeded</p></div>
  <div class="content">
    <div class="critical-box">
      <span class="status-badge">RESTRICTED</span>
      <h2 style="margin: 20px 0 10px;">Immediate Action Required</h2>
      <p>Your API access has been blocked due to quota exceeded.</p>
    </div>
    <div style="text-align: center; margin: 30px 0;"><a href="${upgradeUrl}" class="button">⚡ Upgrade to Restore Access</a></div>
    <p style="text-align: center; color: #6b7280;">Questions? Contact support@sophia.agencyos.network</p>
  </div>
</div></body></html>`;
}

/**
 * Get alert template for a given threshold and channel
 */
export function getAlertTemplate(context: QuotaAlertContext, channel: AlertChannel): AlertTemplate {
  const { threshold, percentage, limit, currentUsage } = context;
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase();
  const usageType = context.exceededType.replace('_', ' ');
  const billingUrl = '/dashboard/billing';
  const upgradeUrl = '/dashboard/billing?action=upgrade';

  if (channel === 'email') {
    if (threshold === 80) {
      return {
        subject: `[Sophia AI] Usage Alert: ${percentage.toFixed(0)}% of ${tierDisplay} plan used`,
        body: `Hi there,\n\nYour Sophia AI usage has reached ${percentage.toFixed(0)}% of your ${tierDisplay} plan limit.\n\nUsage: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}\n\nView dashboard: ${billingUrl}`,
        htmlBody: buildEmailHtml80(context),
      };
    } else if (threshold === 90) {
      return {
        subject: `[Sophia AI] URGENT: ${percentage.toFixed(0)}% of ${tierDisplay} plan used - Action Required`,
        body: `Hi there,\n\nURGENT: ${percentage.toFixed(0)}% of your ${tierDisplay} plan used.\n\n${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}\n\nUpgrade now: ${upgradeUrl}`,
        htmlBody: buildEmailHtml90(context),
      };
    } else {
      return {
        subject: `[Sophia AI] CRITICAL: Service Restricted - ${tierDisplay} Plan Limit Exceeded`,
        body: `CRITICAL: Your ${tierDisplay} plan limit has been reached.\n\n${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}\n\nUpgrade now: ${upgradeUrl}\nContact support: support@sophia.agencyos.network`,
        htmlBody: buildEmailHtml100(),
      };
    }
  }

  // SMS templates
  if (threshold === 80) {
    return { subject: '', body: '', smsBody: `Sophia AI Alert: You've used ${percentage.toFixed(0)}% of your ${tierDisplay} plan. Monitor: ${billingUrl}` };
  } else if (threshold === 90) {
    return { subject: '', body: '', smsBody: `URGENT: ${percentage.toFixed(0)}% of Sophia AI plan used. Upgrade to avoid restriction: ${upgradeUrl}` };
  } else {
    return { subject: '', body: '', smsBody: `CRITICAL: Sophia AI service restricted. Upgrade to restore: ${upgradeUrl}` };
  }
}

// -------------------------------------------------------------------------
// Rate limiting
// -------------------------------------------------------------------------

/**
 * Check if an alert is rate-limited (true = suppress alert)
 */
export async function isRateLimited(
  userId: string,
  threshold: AlertThreshold,
  config: AlertConfig
): Promise<boolean> {
  try {
    const db = createServerClient();
    const windowStart = Date.now() - (config.rateLimitWindowSeconds * 1000);

    const { data: recentAlerts } = await db
      .from('quota_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('threshold', threshold)
      .gte('sent_at', new Date(windowStart).toISOString())
      .limit(1);

    return (recentAlerts?.length ?? 0) > 0;
  } catch (error) {
    logger.error('[Quota Alert] Error checking rate limit', error as Error);
    return false; // Fail-open
  }
}

// -------------------------------------------------------------------------
// Multi-threshold evaluation
// -------------------------------------------------------------------------

/**
 * Determine which alert thresholds to trigger for a given usage percentage
 */
export function determineThresholdsToTrigger(percentage: number): AlertThreshold[] {
  if (percentage >= 100) return [100, 90, 80];
  if (percentage >= 90) return [90, 80];
  if (percentage >= 80) return [80];
  return [];
}
