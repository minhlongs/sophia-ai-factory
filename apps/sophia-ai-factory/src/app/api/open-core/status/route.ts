/**
 * GET & POST /api/open-core/status
 *
 * - GET (`mode: 'runtime_status'`): Authenticated runtime edition and feature gate
 *   evaluation bound to the caller's actual D1 subscription tier (`getUserTier`)
 *   or server-configured `RAAS_LICENSE_KEY`.
 * - POST (`mode: 'validation_preview'`, `persisted: false`): Stateless server-side
 *   HMAC-SHA256 validation preview for a `SOPHIA-RAAS-v1` token bound to the
 *   authenticated caller's organization/user ID.
 *
 * @module app/api/open-core/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/org-resolver/org-resolver-service';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  resolveSophiaEdition,
  type EditionContextInput,
} from '@/seed/config/edition-config';
import { verifyRaasLicenseToken } from '@/seed/security/raas-license-verifier';
import { auditOpenCore25StepCatalog } from '@/tree/open-core/open-core-25-steps-auditor';
import { auditVideoBlueprintCatalog } from '@/tree/open-core/video-blueprint-auditor';
import { checkUpstreamReleaseBeacon } from '@/tree/open-core/version-beacon';
import {
  evaluateAllFeatureGates,
  resolveServerEditionContext,
} from './status-context-resolver';
import type { VideoBlueprintAuditReport } from '@/tree/open-core/video-blueprint-auditor';

export const dynamic = 'force-dynamic';

const verifyLicenseBodySchema = z.object({
  licenseKey: z.string().min(20, 'License key is required'),
});

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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_JSON', message: 'Invalid JSON request body' },
      { status: 400 },
    );
  }

  const parsed = verifyLicenseBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const secret = (process.env.RAAS_LICENSE_SECRET ?? '').trim();
  const verification = await verifyRaasLicenseToken(parsed.data.licenseKey, secret);

  if (!verification.valid || !verification.payload) {
    return NextResponse.json(
      {
        success: false, valid: false, mode: 'validation_preview', persisted: false,
        reason: verification.reason ?? 'SIGNATURE_MISMATCH',
        pricingUrl: 'https://sophia.agencyos.network/pricing',
      },
      { status: 422 },
    );
  }

  const resolvedOrgId = await resolveOrgId(user.id).catch(() => null);
  const callerOrgId = resolvedOrgId ?? user.id;
  if (verification.payload.orgId !== callerOrgId && verification.payload.orgId !== user.id) {
    return NextResponse.json(
      { success: false, valid: false, mode: 'validation_preview', persisted: false, reason: 'ORG_MISMATCH' },
      { status: 403 },
    );
  }

  const ctx: EditionContextInput = {
    sophiaEdition: verification.payload.edition,
    hasValidRaasLicense: true,
    licensedTier: verification.payload.tier,
  };

  return NextResponse.json({
    success: true, valid: true, mode: 'validation_preview', persisted: false,
    edition: resolveSophiaEdition(ctx),
    licenseSummary: {
      edition: verification.payload.edition,
      tier: verification.payload.tier,
      expiresAt: verification.payload.expiresAt,
      whiteLabelEnabled: Boolean(verification.payload.whiteLabelEnabled),
    },
    features: evaluateAllFeatureGates(ctx),
  });
}
