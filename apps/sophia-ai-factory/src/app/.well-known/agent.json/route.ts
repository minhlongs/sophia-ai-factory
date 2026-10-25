/**
 * Machine-readable Agent Discovery Manifest at /.well-known/agent.json.
 * Enables autonomous AI agents and Answer Engines to discover Sophia capabilities.
 */

import { NextResponse } from 'next/server';
import { buildAgentDiscoveryManifest } from '@/seed/aeo';

export async function GET(): Promise<NextResponse> {
  const manifest = buildAgentDiscoveryManifest();
  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
    },
  });
}
