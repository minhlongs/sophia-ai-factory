/**
 * Helpers for handover verification route.
 * Layer: app/api/admin/handover/verify
 * @module app/api/admin/handover/verify/handover-verify-helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDeploy } from '@/seed/auth/require-admin';
import type { VerificationRunReport } from '@/seed/handover/handover-types';

/**
 * Validates request authentication via admin session, deploy guard token, or system bearer secret.
 */
export async function checkVerificationAuth(request: NextRequest): Promise<true | NextResponse> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const cronSecret = process.env.CRON_SECRET;
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if ((cronSecret && token === cronSecret) || (internalSecret && token === internalSecret)) {
      return true;
    }
  }

  const auth = await requireAdminOrDeploy(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  return true;
}

export function parseVerificationParams(request: NextRequest): {
  handoverId: string | undefined;
  persist: boolean;
  timeoutMs: number;
  baseUrl: string;
} {
  const url = new URL(request.url);
  const handoverId = url.searchParams.get('handoverId') ?? undefined;
  const persist = url.searchParams.get('persist') === '1' || url.searchParams.get('persist') === 'true';
  const timeoutMs = Math.min(Number(url.searchParams.get('timeoutMs') ?? '4000'), 10000);
  const baseUrl = url.origin;
  return { handoverId, persist, timeoutMs, baseUrl };
}

export function parseVerificationBody(request: NextRequest): Promise<{
  handoverId: string | undefined;
  persist: boolean;
  timeoutMs: number;
}> {
  return request.json().then((body: unknown) => {
    const b = body as Record<string, unknown>;
    return {
      handoverId: (b.handoverId as string) || undefined,
      persist: b.persist === true,
      timeoutMs: Math.min(Number(b.timeoutMs ?? '4000'), 10000),
    };
  }).catch(() => ({
    handoverId: undefined,
    persist: false,
    timeoutMs: 4000,
  }));
}

type VerificationResponseBody = VerificationRunReport | {
  overallVerdict: string;
  passedCount: number;
  totalChecks: number;
  error: string;
  message: string;
};

export function createVerificationResponse(report: VerificationResponseBody, status = 200): NextResponse {
  return NextResponse.json(report, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Handover-Verdict': report.overallVerdict,
      'X-Checks-Passed': `${report.passedCount}/${report.totalChecks}`,
    },
  });
}
