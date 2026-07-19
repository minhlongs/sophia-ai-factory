/**
 * GET /api/openapi
 *
 * Public OpenAPI 3.1 specification for the Sophia v1 surface.
 * Open to anonymous callers — the spec only describes the API contract,
 * not user data.
 *
 * @module app/api/openapi/route
 */

import { NextResponse } from 'next/server';
import { OPENAPI_SPEC } from '@/seed/openapi/spec';

export const dynamic = 'force-static';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(OPENAPI_SPEC, {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=300',
    },
  });
}
