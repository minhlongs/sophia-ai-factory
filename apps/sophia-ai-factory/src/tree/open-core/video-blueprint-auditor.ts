/**
 * Validates the registered video blueprint catalog for runtime status reporting.
 *
 * Layer: tree/open-core
 */

import {
  ALL_CRYPTO_BLUEPRINTS,
  ALL_SAAS_BLUEPRINTS,
  VideoBlueprintSchema,
} from '@/seed/config/video-blueprints';

export interface VideoBlueprintAuditReport {
  readonly totalBlueprints: number;
  readonly validBlueprints: number;
  readonly invalidBlueprintIds: readonly string[];
  readonly duplicateBlueprintIds: readonly string[];
  readonly catalogComplete: boolean;
}

export function auditVideoBlueprintCatalog(): VideoBlueprintAuditReport {
  const blueprints = [...ALL_SAAS_BLUEPRINTS, ...ALL_CRYPTO_BLUEPRINTS];
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const invalidIds: string[] = [];
  let validBlueprints = 0;

  for (const blueprint of blueprints) {
    if (seenIds.has(blueprint.id)) duplicateIds.add(blueprint.id);
    seenIds.add(blueprint.id);

    if (VideoBlueprintSchema.safeParse(blueprint).success) {
      validBlueprints++;
    } else {
      invalidIds.push(blueprint.id);
    }
  }

  const duplicateBlueprintIds = [...duplicateIds].sort();
  const invalidBlueprintIds = [...new Set(invalidIds)].sort();

  return {
    totalBlueprints: blueprints.length,
    validBlueprints,
    invalidBlueprintIds,
    duplicateBlueprintIds,
    catalogComplete:
      blueprints.length > 0 &&
      validBlueprints === blueprints.length &&
      duplicateBlueprintIds.length === 0,
  };
}
