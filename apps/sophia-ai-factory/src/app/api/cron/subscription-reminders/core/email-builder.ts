export function buildRenewalReminderHtml(
  name: string,
  plan: string,
  daysLeft: number,
  expiresAt: string,
): string {
  const displayName = name || 'there';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Your Sophia AI subscription renews in ${daysLeft} days</h2>
  <p>Hi ${displayName},</p>
  <p>Your <strong>${plan.toUpperCase()}</strong> plan expires on <strong>${expiresAt}</strong>.</p>
  <p>To continue uninterrupted access, please ensure your payment method is up to date.</p>
  <a href="https://sophia.agencyos.network/dashboard/billing"
     style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
    Manage Billing
  </a>
  <p style="font-size:13px;color:#666;">Questions? Reply to this email or message @Sophia_Bbot on Telegram.</p>
</body></html>`;
}
