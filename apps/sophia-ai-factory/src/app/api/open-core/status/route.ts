/**
 * GET & POST /api/open-core/status
 *
 * - GET: Returns active runtime edition (`community` | `cloud` | `enterprise`),
 *   all 12 canonical feature gate evaluations, and optional release beacon status.
 * - POST: Verifies a submitted `SOPHIA-RAAS-v1` Commercial License Key via
 *   Web Crypto HMAC-SHA256 (`verifyRaasLicenseToken`) and returns the unlocked
 *   edition, tier, and feature gate matrix.
 *
 * @module app/api/open-core/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
  const envLicenseKey = (process.env.RAAS_LICENSE_KEY ?? '').trim();
  const envSecret = (process.env.RAAS_LICENSE_SECRET ?? '').trim();

  let hasValidRaasLicense = false;
  let licensedTier: EditionContextInput['licensedTier'];

  if (envLicenseKey && envSecret.length >= 16) {
    const verified = await verifyRaasLicenseToken(envLicenseKey, envSecret);
    if (verified.valid && verified.payload) {
      hasValidRaasLicense = true;
      licensedTier = verified.payload.tier;
    }
  }

  const ctx: EditionContextInput = {
    sophiaEdition: process.env.SOPHIA_EDITION,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin,
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
    edition,
    hasValidRaasLicense,
    licensedTier: licensedTier ?? null,
    pricingUrl: 'https://sophia.agencyos.network/pricing',
    features,
    beacon,
  });
}

export async function POST(request: NextRequest) {
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
        reason: verification.reason ?? 'SIGNATURE_MISMATCH',
        pricingUrl: 'https://sophia.agencyos.network/pricing',
      },
      { status: 422 },
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
    edition: resolveSophiaEdition(ctx),
    license: verification.payload,
    features: evaluateAllFeatureGates(ctx),
  });
}
