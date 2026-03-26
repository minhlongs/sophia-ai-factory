/**
 * GET /api/v1/
 * Public API version info endpoint.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: 'v1',
    status: 'ok',
    docs: '/docs/api',
  });
}
