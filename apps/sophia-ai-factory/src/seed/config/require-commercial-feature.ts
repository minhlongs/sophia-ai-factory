/**
 * Server-side enforcement for the Open-Core feature gate.
 *
 * `edition-config.ts` decides whether a feature is unlocked; this module is what
 * a route or server action calls so that decision actually bites. Without it the
 * manifest's `minPaidTier` is documentation rather than enforcement, and a
 * community self-host can reach commercial surfaces.
 *
 * Returns a Result instead of throwing, because callers here are financial and
 * a thrown gate error is indistinguishable from a real failure downstream.
 *
 * Layer: seed/config
 * @module seed/config/require-commercial-feature
 */

import { evaluateFeatureGate, type EditionContextInput } from './edition-config';
import type { SophiaModuleFeatureId } from './open-core-manifest-types';
import type { Tier } from '@/seed/types';
import { success, failure, type Result } from '@/seed/types/result';

/** Denial payload: carries the bilingual copy the caller should surface. */
export interface CommercialFeatureDenied {
  readonly featureId: SophiaModuleFeatureId;
  readonly reasonCode: FeatureGateDenial['reasonCode'];
  readonly messageVi: string;
  readonly messageEn: string;
  readonly upgradeUrl: string;
}

type FeatureGateDenial = ReturnType<typeof evaluateFeatureGate>;

export interface CommercialFeatureGranted {
  readonly featureId: SophiaModuleFeatureId;
  readonly reasonCode: string;
}

/** Evaluates one feature against an already-built edition context. */
export function requireCommercialFeature(
  featureId: SophiaModuleFeatureId,
  ctx: EditionContextInput,
): Result<CommercialFeatureGranted, CommercialFeatureDenied> {
  const gate = evaluateFeatureGate(featureId, ctx);

  if (gate.allowed) {
    return success({ featureId, reasonCode: gate.reasonCode });
  }

  return failure({
    featureId,
    reasonCode: gate.reasonCode,
    messageVi: gate.messageVi,
    messageEn: gate.messageEn,
    upgradeUrl: gate.upgradeUrl,
  });
}

/**
 * Builds the edition context from a resolved user tier. Kept separate so the
 * caller stays in control of how the tier and license were resolved.
 */
export function buildEditionContext(input: {
  licensedTier?: Tier;
  hasValidRaasLicense?: boolean;
  sophiaEdition?: string;
  appUrl?: string;
}): EditionContextInput {
  return {
    licensedTier: input.licensedTier,
    hasValidRaasLicense: input.hasValidRaasLicense,
    sophiaEdition: input.sophiaEdition,
    appUrl: input.appUrl,
  };
}
