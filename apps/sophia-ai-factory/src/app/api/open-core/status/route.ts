/**
 * GET & POST /api/open-core/status
 * @module app/api/open-core/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { resolveSophiaEdition } from '@/seed/config/edition-config';
import { auditOpenCore25StepCatalog } from '@/tree/open-core/open-core-25-steps-auditor';
import { auditVideoBlueprintCatalog, type VideoBlueprintAuditReport } from '@/tree/open-core/video-blueprint-auditor';
import { checkUpstreamReleaseBeacon } from '@/tree/open-core/version-beacon';
import { evaluateAllFeatureGates, resolveServerEditionContext } from './status-context-resolver';
import { handleLicenseValidationPreview } from './status-license-preview';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    );
  }

  const userTier = await getUserTier(user.id);
  const { ctx, hasValidRaasLicense, licensedTier } = await resolveServerEditionContext(userTier);

  const edition = resolveSophiaEdition(ctx);
  const features = evaluateAllFeatureGates(ctx);
  const auditRes = await auditOpenCore25StepCatalog({ editionContext: ctx });
  const catalogAudit = auditRes.ok ? auditRes.value : null;
  let blueprintAudit: VideoBlueprintAuditReport | null = null;
  try {
    blueprintAudit = auditVideoBlueprintCatalog();
  } catch {
    // Keep runtime status available if the optional blueprint audit fails.
  }
  const includeBeacon = request.nextUrl.searchParams.get('beacon') === 'true';
  const beacon = includeBeacon
    ? await checkUpstreamReleaseBeacon({
        localShortSha: (process.env.COMMIT_SHA ?? 'unknown').slice(0, 8),
      })
    : null;

  return NextResponse.json({
    success: true,
    mode: 'runtime_status',
    persisted: true,
    edition,
    userTier,
    hasValidRaasLicense,
    licensedTier,
    pricingUrl: 'https://sophia.agencyos.network/pricing',
    features,
    catalogAudit,
    blueprintAudit,
    beacon,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    );
  }

  return handleLicenseValidationPreview(request, user.id);
}
