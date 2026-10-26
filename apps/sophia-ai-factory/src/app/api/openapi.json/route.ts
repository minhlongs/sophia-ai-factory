import { NextResponse } from 'next/server';
import { buildOpenApiAgentSpec } from '@/seed/aeo';

export const dynamic = 'force-static';

export async function GET() {
  const spec = buildOpenApiAgentSpec();
  return NextResponse.json(spec, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
