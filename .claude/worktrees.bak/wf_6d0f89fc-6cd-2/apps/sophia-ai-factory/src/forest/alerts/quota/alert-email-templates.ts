/**
 * Alert Email Templates - HTML builders for quota threshold emails
 *
 * Generates HTML email bodies for 80%, 90%, and 100% quota alerts.
 * Each template is self-contained and styled inline for email client compatibility.
 */

import type { QuotaAlertContext } from './alert-rule-evaluator';
import { TIER_ALERT_CONFIGS } from './alert-rule-evaluator';

/**
 * Build email HTML template for quota alert (80% threshold)
 */
export function buildEmailHtml80(context: QuotaAlertContext): string {
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
export function buildEmailHtml90(context: QuotaAlertContext): string {
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
export function buildEmailHtml100(): string {
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
    <p style="text-align: center; color: #6b7280;">Questions? Contact support@mekongmind.com</p>
  </div>
</div></body></html>`;
}
