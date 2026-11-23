/**
 * Server-side invite-only allowlist & pilot feature-disable guards.
 *
 * Enforces:
 * 1. `PILOT_INVITE_ONLY=true` + `PILOT_ALLOWED_EMAILS` across sign-up, email sign-in,
 *    email-OTP, magic-link, and passkey endpoints.
 * 2. `PAYMENTS_ENABLED=false` and `B2_PUBLISH_ENABLED=false` kill-switches on the
 *    isolated private pilot worker so billing and auto-publishing cannot execute.
 *
 * @module seed/pilot/pilot-auth-guard
 */

import { NextResponse } from 'next/server';
import {
  isEmailAllowedForPilot,
  isPilotInviteOnlyEnabled,
  type PilotEnvSource,
} from './pilot-access-policy';

const GUARDED_AUTH_PATHS = [
  '/api/auth/sign-up',
  '/api/auth/sign-in/email',
  '/api/auth/sign-in/magic-link',
  '/api/auth/sign-in/email-otp',
  '/api/auth/sign-in/passkey',
  '/api/auth/magic-link',
  '/api/auth/email-otp',
  '/api/auth/passkey',
] as const;

const PAYMENT_DISABLED_PREFIXES = [
  '/api/payments',
  '/api/billing',
  '/api/checkout',
  '/api/orders',
  '/api/refund-requests',
  '/api/user/wallet',
  '/api/payos',
  '/api/webhooks/payos',
  '/api/webhooks/nowpayments',
  '/api/webhooks/nowpayments-payout',
  '/api/webhooks/overage-billing',
  '/api/webhooks/grabpay',
  '/api/webhooks/promptpay',
  '/api/webhooks/sepa',
  '/api/webhooks/stripe-connect',
] as const;

const PUBLISH_DISABLED_PREFIXES = [
  '/api/b2',
  '/api/publish',
  '/api/publish-approvals',
  '/api/publish-gate',
  '/api/distribution',
  '/api/schedule',
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  const normalized = pathname.toLowerCase();
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function isGuardedPilotAuthPath(pathname: string): boolean {
  return matchesPrefix(pathname, GUARDED_AUTH_PATHS);
}

/**
 * Inspects a buffered UTF-8 JSON body for an email field and returns a 403 NextResponse
 * if `PILOT_INVITE_ONLY=true` rejects it. Fails closed on missing/malformed JSON.
 */
export function enforcePilotAuthAllowlist(
  pathname: string,
  rawBodyText: string,
  env: PilotEnvSource = process.env,
): NextResponse | null {
  if (!isPilotInviteOnlyEnabled(env) || !isGuardedPilotAuthPath(pathname)) {
    return null;
  }

  let email: string | null = null;
  try {
    const parsed = JSON.parse(rawBodyText) as Record<string, unknown>;
    if (typeof parsed.email === 'string') {
      email = parsed.email;
    }
  } catch {
    email = null;
  }

  if (!isEmailAllowedForPilot(email, env)) {
    return NextResponse.json(
      {
        code: 'PILOT_INVITE_REQUIRED',
        error:
          'This private pilot is invite-only. Your email is not on the authorized pilot list. / Chương trình thử nghiệm này chỉ dành cho khách mời. Email của bạn chưa được cấp quyền.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return null;
}

/**
 * Enforces explicit `PAYMENTS_ENABLED=false` and `B2_PUBLISH_ENABLED=false` runtime
 * kill-switches (used by `wrangler.pilot.toml` for the free First-Value pilot).
 */
export function enforcePilotFeatureDisabled(
  pathname: string,
  env: PilotEnvSource = process.env,
): NextResponse | null {
  const paymentsDisabled = (env.PAYMENTS_ENABLED ?? '').trim().toLowerCase() === 'false';
  if (paymentsDisabled && matchesPrefix(pathname, PAYMENT_DISABLED_PREFIXES)) {
    return NextResponse.json(
      {
        code: 'PILOT_PAYMENTS_DISABLED',
        error:
          'Payments are disabled during this free private pilot. / Thanh toán được tắt trong chương trình thử nghiệm miễn phí này.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const publishDisabled = (env.B2_PUBLISH_ENABLED ?? '').trim().toLowerCase() === 'false';
  if (publishDisabled && matchesPrefix(pathname, PUBLISH_DISABLED_PREFIXES)) {
    return NextResponse.json(
      {
        code: 'PILOT_PUBLISHING_DISABLED',
        error:
          'Auto-publishing is disabled during this private pilot. / Tự động đăng bài được tắt trong chương trình thử nghiệm này.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return null;
}
