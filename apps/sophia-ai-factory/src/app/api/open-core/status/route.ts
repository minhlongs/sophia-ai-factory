/**
 * GET & POST /api/open-core/status
 *
 * - GET (`mode: 'runtime_status'`): Authenticated runtime edition and feature gate
 *   evaluation bound to the caller's actual D1 subscription tier (`getUserTier`)
 *   or server-configured `RAAS_LICENSE_KEY`.
 * - POST (`mode: 'validation_preview'`, `persisted: false`): Stateless server-side
 *   HMAC-SHA256 validation preview for a `SOPHIA-RAAS-v1` token bound to the
 *   authenticated caller's organization/user ID. Never exposes raw `orgId`.
 *
 * @module app/api/open-core/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/org-resolver/org-resolver-service';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  OPEN_CORE_FEATURES,
  type SophiaModuleFeatureId,
} from '@/seed/config/open-core-manifest';
import {
  evaluateFeatureGate,
  resolveSophiaEdition,
  type EditionContextInput,
} from '@/seed/config/edition-config';
import { verifyRaasLicenseToken } from '@/seed/security/raas-license-verifier';
import { checkUpstreamReleaseBeacon } from '@/tree/open-core/version-beacon';

export const dynamic = 'force-dynamic';

const verifyLicenseBodySchema = z.object({
  licenseKey: z.string().min(20, 'License key is required'),
});

function evaluateAllFeatureGates(ctx: EditionContextInput) {
  const featureIds = Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[];
  return featureIds.map((id) => evaluateFeatureGate(id, ctx));
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    );
  }

  const userTier = await getUserTier(user.id);
  const envLicenseKey = (process.env.RAAS_LICENSE_KEY ?? '').trim();
  const envSecret = (process.env.RAAS_LICENSE_SECRET ?? '').trim();

  let hasValidRaasLicense = false;
  let envVerifiedTier: EditionContextInput['licensedTier'];

  if (envLicenseKey && envSecret.length >= 16) {
    const verified = await verifyRaasLicenseToken(envLicenseKey, envSecret);
    if (verified.valid && verified.payload) {
      hasValidRaasLicense = true;
      envVerifiedTier = verified.payload.tier;
    }
  }

  const baseEdition = resolveSophiaEdition({
    sophiaEdition: process.env.SOPHIA_EDITION,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    hasValidRaasLicense,
  });

  const licensedTier: EditionContextInput['licensedTier'] = hasValidRaasLicense
    ? envVerifiedTier
    : baseEdition === 'cloud'
      ? userTier
      : undefined;

  const ctx: EditionContextInput = {
    sophiaEdition: process.env.SOPHIA_EDITION,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    hasValidRaasLicense,
    licensedTier,
  };

  const edition = resolveSophiaEdition(ctx);
  const features = evaluateAllFeatureGates(ctx);
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
    licensedTier: licensedTier ?? null,
    pricingUrl: 'https://sophia.agencyos.network/pricing',
    features,
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
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid license key input',
      },
      { status: 400 },
    );
  }

  const secret = (process.env.RAAS_LICENSE_SECRET ?? '').trim();
  const verification = await verifyRaasLicenseToken(parsed.data.licenseKey, secret);

  if (!verification.valid || !verification.payload) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        mode: 'validation_preview',
        persisted: false,
        reason: verification.reason ?? 'SIGNATURE_MISMATCH',
        pricingUrl: 'https://sophia.agencyos.network/pricing',
      },
      { status: 422 },
    );
  }

  const resolvedOrgId = await resolveOrgId(user.id).catch(() => null);
  const callerOrgId = resolvedOrgId ?? user.id;
  if (
    verification.payload.orgId !== callerOrgId &&
    verification.payload.orgId !== user.id
  ) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        mode: 'validation_preview',
        persisted: false,
        reason: 'ORG_MISMATCH',
      },
      { status: 403 },
    );
  }

  const ctx: EditionContextInput = {
    sophiaEdition: verification.payload.edition,
    hasValidRaasLicense: true,
    licensedTier: verification.payload.tier,
  };

  return NextResponse.json({
    success: true,
    valid: true,
    mode: 'validation_preview',
    persisted: false,
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
