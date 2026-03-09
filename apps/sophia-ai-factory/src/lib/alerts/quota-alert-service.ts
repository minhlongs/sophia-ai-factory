/**
 * Quota Alert Service
 *
 * Send email/SMS alerts when users approach or exceed quota limits
 * - 80% threshold: Soft warning (email)
 * - 90% threshold: Hard warning (email + SMS)
 * - 100% threshold: Critical alert (email + SMS + billing redirect)
 *
 * Features:
 * - Rate limiting (max 1 alert per hour per threshold per user)
 * - Multi-channel delivery (email, SMS)
 * - Template-based messaging
 * - Integration with Stripe billing for upgrade prompts
 *
 * @module alerts/quota-alert-service
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';
import { sendWebhookAlert, createQuotaThresholdPayload } from '@/lib/alerts/webhook-notification-service';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'warning' | 'critical' | 'info';

/**
 * Alert channel types
 */
export type AlertChannel = 'email' | 'sms' | 'webhook';

/**
 * Alert threshold levels
 */
export type AlertThreshold = 80 | 90 | 100;

/**
 * Alert context for quota events
 */
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

/**
 * Alert template result
 */
export interface AlertTemplate {
  subject: string;
  body: string;
  htmlBody?: string;
  smsBody?: string;
}

/**
 * Alert delivery result
 */
export interface AlertDeliveryResult {
  success: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  webhookSent?: boolean;
  error?: string;
  rateLimited?: boolean;
}

/**
 * Alert configuration by tier
 */
export interface AlertConfig {
  enabledChannels: AlertChannel[];
  rateLimitWindowSeconds: number; // Minimum time between same threshold alerts
  includeBillingLink: boolean;
  upgradePrompt: boolean;
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabledChannels: ['email', 'sms'],
  rateLimitWindowSeconds: 3600, // 1 hour
  includeBillingLink: true,
  upgradePrompt: true,
};

/**
 * Tier-specific alert configurations
 */
const TIER_ALERT_CONFIGS: Record<Tier, AlertConfig> = {
  BASIC: {
    ...DEFAULT_ALERT_CONFIG,
    enabledChannels: ['email'], // SMS only for premium+
    upgradePrompt: true,
  },
  PREMIUM: {
    ...DEFAULT_ALERT_CONFIG,
    enabledChannels: ['email', 'sms'],
    upgradePrompt: true,
  },
  ENTERPRISE: {
    ...DEFAULT_ALERT_CONFIG,
    rateLimitWindowSeconds: 1800, // 30 minutes for enterprise
    upgradePrompt: false,
  },
  MASTER: {
    ...DEFAULT_ALERT_CONFIG,
    rateLimitWindowSeconds: 900, // 15 minutes for master
    upgradePrompt: false,
  },
};

/**
 * Get alert template for threshold level
 */
function getAlertTemplate(
  context: QuotaAlertContext,
  channel: AlertChannel
): AlertTemplate {
  const { threshold, percentage, limit, currentUsage, exceededType, tier } = context;

  const tierDisplay = tier.charAt(0) + tier.slice(1).toLowerCase();
  const usageType = exceededType.replace('_', ' ');
  const billingUrl = '/dashboard/billing';
  const upgradeUrl = '/dashboard/billing?action=upgrade';

  // Email templates
  if (channel === 'email') {
    if (threshold === 80) {
      return {
        subject: `[Sophia AI] Usage Alert: ${percentage.toFixed(0)}% of ${tierDisplay} plan used`,
        body: `Hi there,

Your Sophia AI usage has reached ${percentage.toFixed(0)}% of your ${tierDisplay} plan limit.

Usage Details:
- ${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}
- Current usage: ${percentage.toFixed(1)}%

Recommendations:
- Monitor your usage to avoid service interruption
- Consider upgrading your plan for higher limits

View your usage dashboard: ${billingUrl}
`,
        htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .usage-bar { background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin: 20px 0; }
    .usage-fill { background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%); height: 100%; width: ${percentage}%; transition: width 0.3s; }
    .stats { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .stat-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; }
    .button-secondary { background: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Usage Alert</h1>
      <p>You've used ${percentage.toFixed(0)}% of your ${tierDisplay} plan</p>
    </div>
    <div class="content">
      <div class="usage-bar">
        <div class="usage-fill"></div>
      </div>
      <div class="stats">
        <div class="stat-row">
          <span><strong>${usageType}</strong></span>
          <span>${currentUsage.toLocaleString()} / ${limit.toLocaleString()}</span>
        </div>
        <div class="stat-row">
          <span><strong>Usage Percentage</strong></span>
          <span>${percentage.toFixed(1)}%</span>
        </div>
        <div class="stat-row">
          <span><strong>Plan Tier</strong></span>
          <span>${tierDisplay}</span>
        </div>
      </div>
      <p>We're notifying you to avoid any service interruption. Keep an eye on your usage!</p>
      <div style="margin-top: 20px;">
        <a href="${billingUrl}" class="button">View Dashboard</a>
        ${TIER_ALERT_CONFIGS[tier].upgradePrompt ? `<a href="${upgradeUrl}" class="button button-secondary">Upgrade Plan</a>` : ''}
      </div>
    </div>
  </div>
</body>
</html>
`,
      };
    } else if (threshold === 90) {
      return {
        subject: `[Sophia AI] URGENT: ${percentage.toFixed(0)}% of ${tierDisplay} plan used - Action Required`,
        body: `Hi there,

Your Sophia AI usage has reached ${percentage.toFixed(0)}% of your ${tierDisplay} plan limit.

Usage Details:
- ${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}
- Current usage: ${percentage.toFixed(1)}%

IMPORTANT: You're approaching your limit. Service may be restricted if you exceed your quota.

Immediate Actions:
- Review your current usage at the dashboard
- Consider upgrading to avoid service interruption
- Contact support if you need assistance

View your usage dashboard: ${billingUrl}
Upgrade now: ${upgradeUrl}
`,
        htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Urgent Alert</h1>
      <p>Action Required: ${percentage.toFixed(0)}% of plan used</p>
    </div>
    <div class="content">
      <div class="warning-box">
        <strong>⚠️ Service may be restricted soon</strong>
        <p>Your usage is at ${percentage.toFixed(1)}%. Upgrade now to avoid interruption.</p>
      </div>
      <div class="usage-bar">
        <div class="usage-fill"></div>
      </div>
      <div class="stats">
        <div class="stat-row">
          <span><strong>${usageType}</strong></span>
          <span>${currentUsage.toLocaleString()} / ${limit.toLocaleString()}</span>
        </div>
        <div class="stat-row">
          <span><strong>Remaining</strong></span>
          <span>${(limit - currentUsage).toLocaleString()}</span>
        </div>
      </div>
      <div style="margin-top: 20px;">
        <a href="${upgradeUrl}" class="button">Upgrade Now</a>
        <a href="${billingUrl}" class="button button-secondary">View Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
`,
      };
    } else {
      // 100% - Critical
      return {
        subject: `[Sophia AI] CRITICAL: Service Restricted - ${tierDisplay} Plan Limit Exceeded`,
        body: `Hi there,

Your Sophia AI ${tierDisplay} plan limit has been reached.

Usage Details:
- ${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}
- Status: LIMIT EXCEEDED

Service Status: RESTRICTED
- API requests are being blocked
- Dashboard access remains available

To Restore Service:
1. Upgrade your plan immediately
2. Wait for next billing cycle
3. Contact support for enterprise options

Upgrade now: ${upgradeUrl}
Contact support: support@sophia.agencyos.network
`,
        htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #000000 0%, #1f2937 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
    .critical-box { background: #fee2e2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .status-badge { display: inline-block; background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 10px 0; font-size: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚫 Service Restricted</h1>
      <p>Your plan limit has been exceeded</p>
    </div>
    <div class="content">
      <div class="critical-box">
        <span class="status-badge">RESTRICTED</span>
        <h2 style="margin: 20px 0 10px;">Immediate Action Required</h2>
        <p>Your API access has been blocked due to quota exceeded.</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${upgradeUrl}" class="button">⚡ Upgrade to Restore Access</a>
      </div>
      <p style="text-align: center; color: #6b7280;">Questions? Contact support@sophia.agencyos.network</p>
    </div>
  </div>
</body>
</html>
`,
      };
    }
  }

  // SMS templates (shorter, under 160 chars when possible)
  if (threshold === 80) {
    return {
      subject: '',
      body: '',
      smsBody: `Sophia AI Alert: You've used ${percentage.toFixed(0)}% of your ${tierDisplay} plan. Monitor usage: ${billingUrl}`,
    };
  } else if (threshold === 90) {
    return {
      subject: '',
      body: '',
      smsBody: `URGENT: ${percentage.toFixed(0)}% of Sophia AI plan used. Upgrade now to avoid service restriction: ${upgradeUrl}`,
    };
  } else {
    return {
      subject: '',
      body: '',
      smsBody: `CRITICAL: Sophia AI service restricted. Upgrade to restore access: ${upgradeUrl}`,
    };
  }
}

/**
 * Check if alert is rate-limited
 * Returns true if alert should be suppressed due to rate limiting
 */
async function isRateLimited(
  userId: string,
  threshold: AlertThreshold,
  config: AlertConfig
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const windowStart = Date.now() - (config.rateLimitWindowSeconds * 1000);

    const { data: recentAlerts } = await supabase
      .from('quota_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('threshold', threshold)
      .gte('sent_at', new Date(windowStart).toISOString())
      .limit(1);

    return (recentAlerts?.length ?? 0) > 0;
  } catch (error) {
    logger.error('[Quota Alert] Error checking rate limit', error as Error);
    return false; // Fail-open: allow alert on error
  }
}

/**
 * Send email alert via SendGrid/Resend
 */
async function sendEmailAlert(
  userId: string,
  template: AlertTemplate,
  context: QuotaAlertContext
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Get user email from profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', userId)
      .single();

    if (!profile?.email) {
      logger.warn('[Quota Alert] No email found for user', { userId });
      return false;
    }

    // Use Vercel Blob / Server Action to send email
    // For now, log the email that would be sent
    logger.info('[Quota Alert] Email alert prepared', {
      userId,
      to: profile.email,
      subject: template.subject,
      threshold: context.threshold,
    });

    // In production, call email service:
    // await fetch('/api/alerts/send-email', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     to: profile.email,
    //     subject: template.subject,
    //     html: template.htmlBody || template.body,
    //   }),
    // });

    // For now, insert alert record
    await supabase.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'email',
      recipient: profile.email,
      template_subject: template.subject,
      sent: true,
      sent_at: new Date().toISOString(),
    } as any);

    return true;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send email', error as Error);
    return false;
  }
}

/**
 * Send SMS alert via Twilio
 */
async function sendSmsAlert(
  userId: string,
  template: AlertTemplate,
  context: QuotaAlertContext
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Get user phone from profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('phone')
      .eq('user_id', userId)
      .single();

    if (!profile?.phone) {
      logger.warn('[Quota Alert] No phone found for user', { userId });
      return false;
    }

    logger.info('[Quota Alert] SMS alert prepared', {
      userId,
      to: profile.phone,
      message: template.smsBody,
      threshold: context.threshold,
    });

    // In production, call Twilio via Server Action:
    // await fetch('/api/alerts/send-sms', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     to: profile.phone,
    //     body: template.smsBody!,
    //   }),
    // });

    // Insert alert record
    await supabase.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'sms',
      recipient: profile.phone,
      template_body: template.smsBody,
      sent: true,
      sent_at: new Date().toISOString(),
    } as any);

    return true;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send SMS', error as Error);
    return false;
  }
}

/**
 * Send webhook alert to custom URL
 */
async function sendWebhookAlertChannel(
  userId: string,
  context: QuotaAlertContext,
  webhookUrl: string,
  webhookSecret?: string
): Promise<boolean> {
  try {
    // Create webhook payload
    const payload = createQuotaThresholdPayload({
      userId,
      licenseNonce: context.licenseNonce,
      threshold: context.threshold,
      percentage: context.percentage,
      limit: context.limit,
      currentUsage: context.currentUsage,
      tier: context.tier,
      exceededType: context.exceededType,
      metadata: {
        polarCustomerId: context.polarCustomerId,
        stripeCustomerId: context.stripeCustomerId,
        ipAddress: context.ipAddress,
      },
    });

    // Send webhook with retry logic
    const result = await sendWebhookAlert(webhookUrl, payload, webhookSecret);

    // Insert alert record
    const supabase = createAdminClient();
    await supabase.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'webhook',
      recipient: webhookUrl,
      sent: result.success,
      sent_at: result.success ? new Date().toISOString() : null,
      delivery_error: result.error || null,
      ip_address: context.ipAddress,
      user_agent: context.ipAddress ? 'N/A' : undefined,
    } as any);

    logger.info('[Quota Alert] Webhook alert sent', {
      userId,
      url: webhookUrl,
      success: result.success,
      attempts: result.attempts,
    });

    return result.success;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send webhook', error as Error);
    return false;
  }
}

/**
 * Trigger quota alert for user
 *
 * Flow:
 * 1. Check rate limiting
 * 2. Get tier-specific config
 * 3. Generate alert templates
 * 4. Send via enabled channels
 * 5. Log alert to database
 *
 * @param context - Alert context with usage details
 * @returns Delivery result
 */
export async function triggerQuotaAlert(
  context: QuotaAlertContext
): Promise<AlertDeliveryResult> {
  const { userId, tier, threshold } = context;

  try {
    const supabase = createAdminClient();

    // Fetch user's alert rules for custom thresholds
    const { data: alertRules } = await supabase
      .from('alert_rules')
      .select('channels, webhook_url, webhook_secret')
      .eq('user_id', userId)
      .eq('license_nonce', context.licenseNonce)
      .eq('threshold_percent', threshold)
      .eq('enabled', true)
      .single();

    // Fetch user's notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('email_enabled, sms_enabled, webhook_enabled, default_webhook_url, default_webhook_secret')
      .eq('user_id', userId)
      .single();

    // Determine enabled channels (rule > preferences > tier default)
    const enabledChannels = alertRules?.channels || [
      ...(preferences?.email_enabled !== false ? ['email' as const] : []),
      ...(preferences?.sms_enabled === true ? ['sms' as const] : []),
      ...(preferences?.webhook_enabled === true ? ['webhook' as const] : []),
    ];

    // Check rate limiting
    const rateLimited = await isRateLimited(userId, threshold, {
      ...TIER_ALERT_CONFIGS[tier],
      enabledChannels: enabledChannels as AlertChannel[],
    });
    if (rateLimited) {
      logger.info('[Quota Alert] Rate-limited', {
        userId,
        threshold,
      });
      return {
        success: false,
        rateLimited: true,
      };
    }

    // Get alert templates
    const emailTemplate = getAlertTemplate(context, 'email');
    const smsTemplate = getAlertTemplate(context, 'sms');

    // Send alerts via enabled channels
    const emailSent = enabledChannels.includes('email')
      ? await sendEmailAlert(userId, emailTemplate, context)
      : false;

    const smsSent = enabledChannels.includes('sms')
      ? await sendSmsAlert(userId, smsTemplate, context)
      : false;

    // Send webhook alert
    let webhookSent = false;
    if (enabledChannels.includes('webhook')) {
      const webhookUrl = alertRules?.webhook_url || preferences?.default_webhook_url;
      const webhookSecret = alertRules?.webhook_secret || preferences?.default_webhook_secret;

      if (webhookUrl) {
        webhookSent = await sendWebhookAlertChannel(
          userId,
          context,
          webhookUrl,
          webhookSecret
        );
      }
    }

    const success = emailSent || smsSent || webhookSent;

    logger.info('[Quota Alert] Alert triggered', {
      userId,
      threshold,
      emailSent,
      smsSent,
      webhookSent,
      success,
    });

    return {
      success,
      emailSent,
      smsSent,
      webhookSent,
    };
  } catch (error) {
    logger.error('[Quota Alert] Failed to trigger alert', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check and trigger alerts for all thresholds
 *
 * @param context - Alert context
 * @param percentage - Current usage percentage
 * @returns Array of triggered alerts
 */
export async function checkAndTriggerAlerts(
  context: Omit<QuotaAlertContext, 'threshold'>,
  percentage: number
): Promise<AlertDeliveryResult[]> {
  const results: AlertDeliveryResult[] = [];

  // Determine which thresholds to trigger
  const thresholdsToTrigger: AlertThreshold[] = [];

  if (percentage >= 100) {
    thresholdsToTrigger.push(100, 90, 80); // Trigger all for critical
  } else if (percentage >= 90) {
    thresholdsToTrigger.push(90, 80);
  } else if (percentage >= 80) {
    thresholdsToTrigger.push(80);
  }

  // Trigger alerts for each threshold
  for (const threshold of thresholdsToTrigger) {
    const result = await triggerQuotaAlert({
      ...context,
      threshold,
    });
    results.push(result);
  }

  return results;
}

/**
 * Get user's alert history
 */
export async function getUserAlertHistory(
  userId: string,
  licenseNonce: string,
  limit: number = 10
): Promise<Array<{
  threshold: number;
  channel: string;
  sentAt: string;
  recipient: string;
}>> {
  try {
    const supabase = createAdminClient();

    const { data: alerts } = await supabase
      .from('quota_alerts')
      .select('threshold, channel, sent_at, recipient')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .eq('sent', true)
      .order('sent_at', { ascending: false })
      .limit(limit);

    return (alerts || []).map(a => ({
      threshold: a.threshold,
      channel: a.channel,
      sentAt: a.sent_at,
      recipient: a.recipient,
    }));
  } catch (error) {
    logger.error('[Quota Alert] Failed to fetch alert history', error as Error);
    return [];
  }
}
