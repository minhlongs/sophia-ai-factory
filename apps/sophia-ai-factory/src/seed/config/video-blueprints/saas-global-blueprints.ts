/**
 * SaaS Global Video Blueprints Facade
 *
 * Re-exports SaaS blueprints for recurring MRR conversion.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/saas-global-blueprints
 */

import type { VideoBlueprint } from './blueprint-types';
import { SAAS_BLUEPRINT_PROBLEM_AGITATION_SOLUTION } from './saas-pas-blueprint';
import { SAAS_BLUEPRINT_TOOL_BATTLE_VS } from './saas-battle-blueprint';
import { SAAS_BLUEPRINT_FAST_LISTICLE_TOP_TOOLS } from './saas-listicle-blueprint';

export {
  SAAS_BLUEPRINT_PROBLEM_AGITATION_SOLUTION,
  SAAS_BLUEPRINT_TOOL_BATTLE_VS,
  SAAS_BLUEPRINT_FAST_LISTICLE_TOP_TOOLS,
};

export const ALL_SAAS_BLUEPRINTS: VideoBlueprint[] = [
  SAAS_BLUEPRINT_PROBLEM_AGITATION_SOLUTION,
  SAAS_BLUEPRINT_TOOL_BATTLE_VS,
  SAAS_BLUEPRINT_FAST_LISTICLE_TOP_TOOLS,
];
