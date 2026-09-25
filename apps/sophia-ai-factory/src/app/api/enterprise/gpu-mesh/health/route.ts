/**
 * Enterprise GPU Mesh Health & Telemetry API — /api/enterprise/gpu-mesh/health
 *
 * Provides real-time health telemetry across APAC, US, and EU GPU mesh clusters,
 * and accepts regional probe updates with automatic circuit breaker evaluation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Safe } from '@/seed/db/client';
import {
  getRegionsHealth,
  getRegionHealth,
  updateRegionHealthTelemetry,
} from '@/tree/gpu-mesh/multi-region-router';
import { isGpuMeshRegion, type GpuMeshRegion } from '@/seed/types/gpu-mesh';
import { timingSafeEqual } from '@/seed/security/crypto-utils';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return true;
  }
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get('authorization') ?? '';

  if (cronSecret && timingSafeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }
  if (adminSecret && timingSafeEqual(authHeader, `Bearer ${adminSecret}`)) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const db = await getD1Safe();
  if (!db) {
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const regionParam = searchParams.get('region');

  try {
    if (regionParam) {
      if (!isGpuMeshRegion(regionParam)) {
        return NextResponse.json(
          { error: `Invalid region: ${regionParam}. Must be apac, us, or eu` },
          { status: 400 },
        );
      }
      const health = await getRegionHealth(db, regionParam as GpuMeshRegion);
      if (!health) {
        return NextResponse.json({ error: 'Region health not found' }, { status: 404 });
      }
      return NextResponse.json({ region: health });
    }

    const allHealth = await getRegionsHealth(db);
    return NextResponse.json({
      timestamp: Math.floor(Date.now() / 1000),
      regions: allHealth,
    });
  } catch (error) {
    logger.error('[gpu-mesh-health-api] Error reading health telemetry', {
      error: String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error reading mesh health' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getD1Safe();
  if (!db) {
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { region } = body;

    if (!region || !isGpuMeshRegion(region)) {
      return NextResponse.json(
        { error: 'Valid region (apac, us, eu) is required' },
        { status: 400 },
      );
    }

    const updated = await updateRegionHealthTelemetry(db, {
      region,
      p95LatencyMs: typeof body.p95LatencyMs === 'number' ? body.p95LatencyMs : undefined,
      errorRatePct: typeof body.errorRatePct === 'number' ? body.errorRatePct : undefined,
      activeReservations:
        typeof body.activeReservations === 'number' ? body.activeReservations : undefined,
      availableCapacityPct:
        typeof body.availableCapacityPct === 'number'
          ? body.availableCapacityPct
          : undefined,
      probeDetails:
        typeof body.probeDetails === 'object' && body.probeDetails !== null
          ? (body.probeDetails as Record<string, unknown>)
          : undefined,
    });

    return NextResponse.json({
      status: 'ok',
      health: updated,
    });
  } catch (error) {
    logger.error('[gpu-mesh-health-api] Error updating regional telemetry', {
      error: String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error updating mesh telemetry' },
      { status: 500 },
    );
  }
}
