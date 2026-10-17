/**
 * Helper to resolve runtime edition context and evaluate gates for /api/open-core/status
 *
 * @module app/api/open-core/status/status-context-resolver
 */

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

export function evaluateAllFeatureGates(ctx: EditionContextInput) {
  const featureIds = Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[];
  return featureIds.map((id) => evaluateFeatureGate(id, ctx));
}

export async function resolveServerEditionContext(userTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'): Promise<{
  ctx: EditionContextInput;
  hasValidRaasLicense: boolean;
  licensedTier: EditionContextInput['licensedTier'] | null;
}> {
  const envKey = (process.env.RAAS_LICENSE_KEY ?? '').trim();
  const envSecret = (process.env.RAAS_LICENSE_SECRET ?? '').trim();

  let hasValidRaasLicense = false;
  let envVerifiedTier: EditionContextInput['licensedTier'];

  if (envKey && envSecret.length >= 16) {
    const verified = await verifyRaasLicenseToken(envKey, envSecret);
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

  return { ctx, hasValidRaasLicense, licensedTier: licensedTier ?? null };
}
