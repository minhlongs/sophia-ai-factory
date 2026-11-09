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
  type EditionContextInput,
} from '@/seed/config/edition-config';
import { resolveServerEditionContext } from '@/seed/config/enforce-commercial-feature-server';

export { resolveServerEditionContext };

export function evaluateAllFeatureGates(ctx: EditionContextInput) {
  const featureIds = Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[];
  return featureIds.map((id) => evaluateFeatureGate(id, ctx));
}
