/**
 * GET /api/admin/handover/export-env
 * Layer: app router route handler
 *
 * Generates a sanitized .env.production bundle for customer handover and offline vault storage.
 * Masks all secrets with length markers while preserving verified public configurations.
 *
 * Query params:
 *   format: "text" | "env" (default, returns file attachment) | "json" (returns JSON summary)
 *
 * Auth: Admin session cookie, X-Deploy-Guard-Token, or Bearer CRON_SECRET/INTERNAL_API_SECRET.
 *
 * @module app/api/admin/handover/export-env/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { generateSanitizedEnvProduction } from '@/tree/handover/env-export-generator';
import { CANONICAL_ENV_TEMPLATE, checkExportAuth } from './export-env-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authCheck = await checkExportAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const url = new URL(request.url);
  const format = url.searchParams.get('format') ?? 'env';

  try {
    const envMap: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(process.env)) {
      envMap[k] = v;
    }

    const result = generateSanitizedEnvProduction(CANONICAL_ENV_TEMPLATE, envMap);

    if (format === 'json') {
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    return new NextResponse(result.sanitizedContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename=".env.production"',
        'Cache-Control': 'no-store, max-age=0',
        'X-Missing-Keys': String(result.missingKeys.length),
        'X-Total-Keys': String(result.totalKeys),
      },
    });
  } catch (err) {
    logger.error('[api/admin/handover/export-env] Failed to generate sanitized env export', err instanceof Error ? err : undefined);
    return NextResponse.json(
      {
        error: 'Export generation failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
