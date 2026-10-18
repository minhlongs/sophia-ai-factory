/**
 * POST body validation and org-binding preview logic for /api/open-core/status.
 * @module app/api/open-core/status/status-license-preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveOrgId } from '@/seed/auth/org-resolver/org-resolver-service';
import { resolveSophiaEdition, type EditionContextInput } from '@/seed/config/edition-config';
import { verifyRaasLicenseToken } from '@/seed/security/raas-license-verifier';
import { evaluateAllFeatureGates } from './status-context-resolver';

const verifyLicenseBodySchema = z.object({
  licenseKey: z.string().min(20, 'License key is required'),
});

export async function handleLicenseValidationPreview(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
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

  const resolvedOrgId = await resolveOrgId(userId).catch(() => null);
  const callerOrgId = resolvedOrgId ?? userId;
  if (verification.payload.orgId !== callerOrgId && verification.payload.orgId !== userId) {
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
