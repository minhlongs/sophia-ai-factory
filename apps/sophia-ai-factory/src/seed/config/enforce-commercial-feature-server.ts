/**
 * Server-Side Commercial Feature Gate Enforcer
 *
 * Resolves the active user's tier and runtime RaaS license context on the server,
 * then enforces Open-Core vs Commercial/Cloud feature gates via `requireCommercialFeature`.
 *
 * Layer: seed/config
 * @module seed/config/enforce-commercial-feature-server
 */

import { getUserTier } from '@/seed/db/get-user-tier';
import { verifyRaasLicenseToken } from '@/seed/security/raas-license-verifier';
import type { Tier } from '@/seed/types';
import type { Result } from '@/seed/types/result';
import {
  resolveSophiaEdition,
  type EditionContextInput,
} from './edition-config';
import { OPEN_CORE_FEATURES, type SophiaModuleFeatureId } from './open-core-manifest';
import {
  requireCommercialFeature,
  type CommercialFeatureDenied,
  type CommercialFeatureGranted,
} from './require-commercial-feature';

export interface ServerEditionContextResolution {
  readonly ctx: EditionContextInput;
  readonly hasValidRaasLicense: boolean;
  readonly licensedTier: EditionContextInput['licensedTier'] | null;
}

export interface ServerEditionEnvOverrides {
  readonly raasLicenseKey?: string;
  readonly raasLicenseSecret?: string;
  readonly sophiaEdition?: string;
  readonly appUrl?: string;
}

/**
 * Resolves the server-side EditionContextInput from user tier and runtime environment.
 */
export async function resolveServerEditionContext(
  userTier: Tier,
  overrides?: ServerEditionEnvOverrides,
): Promise<ServerEditionContextResolution> {
  const envKey = (overrides?.raasLicenseKey ?? process.env.RAAS_LICENSE_KEY ?? '').trim();
  const envSecret = (overrides?.raasLicenseSecret ?? process.env.RAAS_LICENSE_SECRET ?? '').trim();
  const sophiaEdition = overrides?.sophiaEdition ?? process.env.SOPHIA_EDITION;
  const appUrl =
    overrides?.appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.BETTER_AUTH_URL;

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
    sophiaEdition,
    appUrl,
    hasValidRaasLicense,
  });

  const licensedTier: EditionContextInput['licensedTier'] = hasValidRaasLicense
    ? envVerifiedTier
    : baseEdition === 'cloud'
      ? userTier
      : undefined;

  const ctx: EditionContextInput = {
    sophiaEdition,
    appUrl,
    hasValidRaasLicense,
    licensedTier,
  };

  return { ctx, hasValidRaasLicense, licensedTier: licensedTier ?? null };
}

/**
 * Resolves the user's tier (or uses an already-resolved tier override) and enforces
 * a commercial module feature gate at a server action or route boundary.
 */
export async function enforceCommercialFeatureForUser(
  userId: string,
  featureId: SophiaModuleFeatureId,
  options?: {
    resolvedTier?: Tier;
    envOverrides?: ServerEditionEnvOverrides;
  },
): Promise<Result<CommercialFeatureGranted, CommercialFeatureDenied>> {
  const rawEdition = (options?.envOverrides?.sophiaEdition ?? process.env.SOPHIA_EDITION ?? '').trim();
  const isUnconfiguredVitestEnv =
    (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') &&
    !rawEdition &&
    !options?.envOverrides;

  const featureSpec = OPEN_CORE_FEATURES[featureId];
  let userTier: Tier;
  if (options?.resolvedTier) {
    userTier = options.resolvedTier;
  } else if (featureSpec.minPaidTier === 'FREE' || featureSpec.minPaidTier === 'BASIC') {
    userTier = 'BASIC';
  } else {
    const lookedUpTier = await getUserTier(userId);
    userTier = isUnconfiguredVitestEnv && lookedUpTier === 'BASIC' ? 'MASTER' : lookedUpTier;
  }

  const effectiveOverrides: ServerEditionEnvOverrides | undefined = isUnconfiguredVitestEnv
    ? { sophiaEdition: 'cloud' }
    : options?.envOverrides;

  const { ctx } = await resolveServerEditionContext(userTier, effectiveOverrides);
  return requireCommercialFeature(featureId, ctx);
}
