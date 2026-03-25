/**
 * Email HTML templates for transactional emails.
 *
 * Templates: welcome, mission-complete, trial-ending, invoice
 * All return plain HTML strings — no React Email dependency needed.
 */

const BRAND_COLOR = '#6750A4';
const FOOTER = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:12px;color:#666;">
    <p>Sophia AI Factory — Robot-as-a-Service Platform</p>
    <p><a href="https://sophia.ai" style="color:${BRAND_COLOR}">sophia.ai</a> · <a href="https://sophia.ai/dashboard" style="color:${BRAND_COLOR}">Dashboard</a></p>
  </div>
`;

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
${body}${FOOTER}</body></html>`;
}

// ── Welcome ─────────────────────────────────────────────────────────────────

export function welcomeEmail(name: string, tierName: string, mcuCredits: number): string {
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Welcome to Sophia AI Factory!</h2>
    <p>Hi ${name},</p>
    <p>Your <strong>${tierName}</strong> plan is active with <strong>${mcuCredits.toLocaleString()} MCU</strong> credits.</p>
    <h3>Quick Start</h3>
    <ol>
      <li>Create your first AI mission from the <a href="https://sophia.ai/dashboard/missions/new" style="color:${BRAND_COLOR}">Dashboard</a></li>
      <li>Generate an API key at <a href="https://sophia.ai/dashboard/settings/api-keys" style="color:${BRAND_COLOR}">Settings → API Keys</a></li>
      <li>Explore the <a href="https://sophia.ai/docs/api" style="color:${BRAND_COLOR}">API Reference</a></li>
    </ol>
    <p>Questions? Reply to this email — we respond within 2 hours.</p>
    <p>— Sophia AI Team</p>
  `);
}

// ── Mission Complete ────────────────────────────────────────────────────────

export function missionCompleteEmail(
  name: string,
  missionId: string,
  command: string,
  summary: string,
): string {
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Mission Complete ✓</h2>
    <p>Hi ${name},</p>
    <p>Your mission <code>${command}</code> has finished:</p>
    <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:14px;"><strong>ID:</strong> ${missionId}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Result:</strong> ${summary}</p>
    </div>
    <a href="https://sophia.ai/dashboard/missions/${missionId}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Results</a>
  `);
}

// ── Trial Ending ────────────────────────────────────────────────────────────

export function trialEndingEmail(name: string, daysLeft: number): string {
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h2>
    <p>Hi ${name},</p>
    <p>Your free MCU credits are running low. Upgrade to keep your AI missions running without interruption.</p>
    <h3>What you'll lose without upgrading:</h3>
    <ul>
      <li>AI proposal generation</li>
      <li>Lead hunting and scoring</li>
      <li>Automated email outreach</li>
      <li>Sales battlecards and competitor analysis</li>
    </ul>
    <a href="https://sophia.ai/dashboard/billing/upgrade" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Upgrade Now</a>
    <p style="margin-top:16px;font-size:13px;color:#666;">Plans start at $49/mo with 500 MCU credits.</p>
  `);
}

// ── Invoice / Payment Confirmation ──────────────────────────────────────────

export function invoiceEmail(
  name: string,
  amount: string,
  tierName: string,
  invoiceDate: string,
): string {
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Payment Confirmed</h2>
    <p>Hi ${name},</p>
    <p>We received your payment. Here's your receipt:</p>
    <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:14px;"><strong>Plan:</strong> ${tierName}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Amount:</strong> ${amount}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Date:</strong> ${invoiceDate}</p>
    </div>
    <a href="https://sophia.ai/dashboard/billing" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Billing</a>
  `);
}

// ── Magic Link ──────────────────────────────────────────────────────────────

export function magicLinkEmail(token: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.ai';
  const link = `${base}/api/auth/callback?token=${token}`;
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Sign in to Sophia AI</h2>
    <p>Click the button below to sign in. This link expires in 15 minutes.</p>
    <a href="${link}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Sign In</a>
    <p style="font-size:13px;color:#666;">If you didn't request this, you can safely ignore this email.</p>
  `);
}
