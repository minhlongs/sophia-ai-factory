/**
 * HTML layout primitives for billing email templates
 * @module billing/email/email-template-html-layout
 */

import type { EmailTemplateType } from './types'

export const TEMPLATE_COLORS: Record<EmailTemplateType, { bg: string; header: string; accent: string }> = {
  payment_failed:       { bg: '#fef2f2', header: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', accent: '#dc2626' },
  grace_period_warning: { bg: '#fef3c7', header: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', accent: '#f59e0b' },
  suspension_notice:    { bg: '#fef2f2', header: 'linear-gradient(135deg, #000000 0%, #1f2937 100%)', accent: '#dc2626' },
  payment_succeeded:    { bg: '#f0fdf4', header: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', accent: '#16a34a' },
  overage_detected:     { bg: '#eff6ff', header: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', accent: '#2563eb' },
}

export function getTypeEmoji(type: EmailTemplateType): string {
  switch (type) {
    case 'suspension_notice':    return '🚫'
    case 'grace_period_warning': return '⚠️'
    case 'payment_succeeded':    return '✅'
    default:                     return '💳'
  }
}

export function getEmailCss(color: { bg: string; header: string; accent: string }): string {
  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color.header}; color: white; padding: 30px; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .content { background: ${color.bg}; padding: 30px; border-radius: 0 0 12px 12px; }
    .details-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row .label { color: #6b7280; }
    .detail-row .value { font-weight: 600; }
    .detail-row .value.success { color: #16a34a; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .critical-box { background: #fee2e2; border: 2px solid #dc2626; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .status-badge { display: inline-block; background: #dc2626; color: white; padding: 6px 20px; border-radius: 20px; font-weight: bold; font-size: 14px; }
    .button { display: inline-block; background: ${color.accent}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 15px 5px 10px 0; font-weight: 600; }
    .button-secondary { background: #6b7280; }
    .footer { text-align: center; padding: 30px 20px; color: #6b7280; font-size: 14px; }
    @media (max-width: 600px) { .container { padding: 10px; } .header, .content { padding: 20px; } }
  `
}

export function wrapHtmlTemplate(
  mainContent: string,
  ctaButton: string,
  color: { bg: string; header: string; accent: string },
  titleEmoji: string,
  titleText: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getEmailCss(color)}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${titleEmoji} ${titleText}</h1></div>
    <div class="content">
      ${mainContent}
      <div style="text-align: center; margin: 25px 0;">${ctaButton}</div>
      <p style="margin-top: 25px; color: #6b7280; font-size: 14px;">
        Need help? <a href="mailto:support@mekongmind.com" style="color: ${color.accent};">support@mekongmind.com</a>
      </p>
    </div>
    <div class="footer"><p>© 2026 Sophia AI Factory. All rights reserved.</p><p>Sophia AI - AI Video Factory</p></div>
  </div>
</body>
</html>`.trim()
}
