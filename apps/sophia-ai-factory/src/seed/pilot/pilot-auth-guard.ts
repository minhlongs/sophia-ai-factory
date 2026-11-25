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
  '/api/promo',
  '/api/refund-requests',
  '/api/user/wallet',
  '/api/v1/credits',
  '/api/payos',
  '/api/webhooks/payos',
  '/api/webhooks/nowpayments',
  '/api/webhooks/nowpayments-payout',
  '/api/webhooks/overage-billing',
  '/api/webhooks/grabpay',
  '/api/webhooks/promptpay',
  '/api/webhooks/saas-crypto',
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
  '/api/v1/distribute',
  '/api/oauth',
] as const;

const VIDEO_DISTRIBUTE_PATTERN = /^\/api\/v1\/videos\/[^/]+\/distribute(?:\/|$)/i;

/**
 * Strict API surface allowlist when `PILOT_INVITE_ONLY=true`.
 * Every other `/api/*` route (including alternate inference, video/TTS, campaign,
 * admin, and BYOK management routes) is blocked fail-closed with 403.
 */
const PILOT_ALLOWED_API_PREFIXES = [
  '/api/auth',
  '/api/first-value',
  '/api/r',
  '/api/health',
  '/api/version',
  '/api/check-access',
  '/api/csp-report',
] as const;

function normalizePathname(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (/[\\\0]/.test(decoded)) {
    return null;
  }
  const collapsed = decoded.replace(/\/{2,}/g, '/').toLowerCase();
  if (/(^|\/)\.\.?(\/|$)/.test(collapsed)) {
    return null;
  }
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
}

function matchesPrefix(normalized: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function isGuardedPilotAuthPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized === null) {
    return true;
  }
  return matchesPrefix(normalized, GUARDED_AUTH_PATHS);
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
 * kill-switches, plus strict `/api/*` surface lockdown when `PILOT_INVITE_ONLY=true`.
 */
export function enforcePilotFeatureDisabled(
  pathname: string,
  env: PilotEnvSource = process.env,
): NextResponse | null {
  const inviteOnly = isPilotInviteOnlyEnabled(env);
  const paymentsDisabled = (env.PAYMENTS_ENABLED ?? '').trim().toLowerCase() === 'false';
  const publishDisabled = (env.B2_PUBLISH_ENABLED ?? '').trim().toLowerCase() === 'false';
  if (!inviteOnly && !paymentsDisabled && !publishDisabled) {
    return null;
  }

  const normalized = normalizePathname(pathname);
  if (normalized === null) {
    return NextResponse.json(
      {
        code: paymentsDisabled
          ? 'PILOT_PAYMENTS_DISABLED'
          : publishDisabled
            ? 'PILOT_PUBLISHING_DISABLED'
            : 'PILOT_FEATURE_DISABLED',
        error: 'Malformed request path rejected during private pilot.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (paymentsDisabled && matchesPrefix(normalized, PAYMENT_DISABLED_PREFIXES)) {
    return NextResponse.json(
      {
        code: 'PILOT_PAYMENTS_DISABLED',
        error:
          'Payments are disabled during this free private pilot. / Thanh toán được tắt trong chương trình thử nghiệm miễn phí này.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (
    publishDisabled &&
    (matchesPrefix(normalized, PUBLISH_DISABLED_PREFIXES) ||
      VIDEO_DISTRIBUTE_PATTERN.test(normalized))
  ) {
    return NextResponse.json(
      {
        code: 'PILOT_PUBLISHING_DISABLED',
        error:
          'Auto-publishing is disabled during this private pilot. / Tự động đăng bài được tắt trong chương trình thử nghiệm này.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (
    inviteOnly &&
    (normalized === '/api' || normalized.startsWith('/api/')) &&
    !matchesPrefix(normalized, PILOT_ALLOWED_API_PREFIXES)
  ) {
    return NextResponse.json(
      {
        code: 'PILOT_FEATURE_DISABLED',
        error:
          'This API route is disabled during the private pilot. / Tính năng API này được tắt trong chương trình thử nghiệm kín.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return null;
}

const SAFE_READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const PILOT_ALLOWED_BARE_PAGES = new Set([
  '/login',
  '/register',
  '/signup',
  '/reset-password',
  '/privacy',
  '/terms',
  '/dashboard/first-value',
]);

/**
 * When `PILOT_INVITE_ONLY=true`, confines UI page navigation strictly to the
 * Private Beta First-Value journey, authentication screens, and legal/privacy
 * pages. All other marketing, billing, video/TTS, publishing, setup, or admin
 * pages redirect to `/{locale}/dashboard/first-value`.
 */
export function enforcePilotPageScopeRedirect(
  request: { readonly url: string; readonly method?: string; readonly nextUrl?: { readonly pathname: string } },
  env: PilotEnvSource = process.env,
): NextResponse | null {
  if (!isPilotInviteOnlyEnabled(env)) {
    return null;
  }

  const method = (request.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return null;
  }

  const pathname = request.nextUrl?.pathname ?? new URL(request.url).pathname;
  if (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/auth/callback')
  ) {
    return null;
  }

  const seg1 = pathname.split('/')[1];
  const hasSupportedLocale = seg1 === 'vi' || seg1 === 'en';
  const locale = hasSupportedLocale ? seg1 : 'vi';
  const rawBarePath = hasSupportedLocale ? pathname.slice(1 + locale.length) || '/' : pathname;
  const bare = normalizePathname(rawBarePath);

  if (bare !== null && PILOT_ALLOWED_BARE_PAGES.has(bare)) {
    return null;
  }

  return NextResponse.redirect(new URL(`/${locale}/dashboard/first-value`, request.url), 307);
}

/**
 * When `PILOT_INVITE_ONLY=true`, blocks all Next.js Server Actions (`next-action`
 * header) and all non-safe-method page mutations on non-`/api/` routes. The pilot
 * workspace uses `/api/first-value` and `/api/auth/*` exclusively (zero Server
 * Actions), so blocking all page-route Server Actions prevents any allowlisted
 * user from invoking arbitrary `src/land/` Server Actions via any URL pathname.
 */
export function enforcePilotServerActionDisabled(
  pathname: string,
  hasNextActionHeader: boolean,
  env: PilotEnvSource = process.env,
  method: string = 'POST',
): NextResponse | null {
  if (!isPilotInviteOnlyEnabled(env)) {
    return null;
  }

  const normalized = normalizePathname(pathname);
  if (normalized === '/api' || normalized?.startsWith('/api/')) {
    return null;
  }

  const upperMethod = method.toUpperCase();
  if (!hasNextActionHeader && SAFE_READ_METHODS.has(upperMethod)) {
    return null;
  }

  return NextResponse.json(
    {
      code: 'PILOT_FEATURE_DISABLED',
      error:
        'This server action is disabled during the private pilot. / Thao tác này được tắt trong chương trình thử nghiệm kín.',
    },
    { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
