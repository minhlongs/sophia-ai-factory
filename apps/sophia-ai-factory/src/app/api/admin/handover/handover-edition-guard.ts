/**
 * Shared commercial feature gate helper for Day-1 Master Handover HTTP routes.
 *
 * @module app/api/admin/handover/handover-edition-guard
 */

import { NextResponse } from 'next/server';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';

export async function guardHandoverCommercialFeature(
  userId = 'system-handover',
): Promise<NextResponse | null> {
  const gate = await enforceCommercialFeatureForUser(
    userId,
    'day1_master_handover_suite',
    { resolvedTier: 'MASTER' },
  );
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'FEATURE_LOCKED', message: gate.error.message },
      { status: 403 },
    );
  }
  return null;
}
