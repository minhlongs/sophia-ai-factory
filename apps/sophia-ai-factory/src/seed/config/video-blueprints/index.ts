/**
 * Unified Video Blueprints Registry
 *
 * Single source of truth for high-converting video blueprints (SaaS & Crypto).
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints
 */

import type { VideoBlueprint, VideoNiche } from './blueprint-types';
import { ALL_SAAS_BLUEPRINTS } from './saas-global-blueprints';
import { ALL_CRYPTO_BLUEPRINTS } from './crypto-global-blueprints';

export * from './blueprint-types';
export * from './saas-global-blueprints';
export * from './crypto-global-blueprints';

const BLUEPRINT_MAP = new Map<string, VideoBlueprint>();

for (const bp of [...ALL_SAAS_BLUEPRINTS, ...ALL_CRYPTO_BLUEPRINTS]) {
  BLUEPRINT_MAP.set(bp.id, bp);
}

/**
 * Retrieve a video blueprint by its unique identifier.
 */
export function getBlueprintById(id: string): VideoBlueprint | undefined {
  return BLUEPRINT_MAP.get(id);
}

/**
 * List all available video blueprints for a specific niche.
 */
export function listBlueprintsByNiche(niche: VideoNiche): VideoBlueprint[] {
  if (niche === 'saas_global') {
    return ALL_SAAS_BLUEPRINTS;
  }
  if (niche === 'crypto_global') {
    return ALL_CRYPTO_BLUEPRINTS;
  }
  return [];
}

/**
 * Retrieve all registered video blueprints across all niches.
 */
export function getAllBlueprints(): VideoBlueprint[] {
  return Array.from(BLUEPRINT_MAP.values());
}
