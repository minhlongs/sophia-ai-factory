/**
 * POST /api/csp-report
 * Lightweight CSP violation receiver. Logs to structured logger at warn level.
 * Browsers POST application/csp-report or application/json depending on the
 * report-to vs report-uri header form. We accept both via raw text parse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';

// Note: do NOT pin runtime='edge' here. The logger dynamically imports
// @sentry/nextjs which uses Node.js APIs unavailable at the Workers edge,
// causing every CSP-report POST to crash with 500. Default Node runtime
// keeps Sentry forwarding intact. Verified by browser bug-hunt 2026-05-19.
export const dynamic = 'force-dynamic';

const MAX_REPORT_BYTES = 16 * 1024; // 16KB cap mitigates DoS via large reports.

export async function POST(request: NextRequest) {
  try {
    const len = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(len) && len > MAX_REPORT_BYTES) {
      // Drop oversized reports without parsing.
      return new NextResponse(null, { status: 413 });
    }
    const text = await request.text();
    if (text.length > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    logger.warn('[csp-report] CSP violation received', {
      ua: request.headers.get('user-agent') ?? 'unknown',
      report: parsed,
    });
  } catch (err) {
    logger.error('[csp-report] Parse failed', err instanceof Error ? err : undefined);
  }
  return new NextResponse(null, { status: 204 });
}
