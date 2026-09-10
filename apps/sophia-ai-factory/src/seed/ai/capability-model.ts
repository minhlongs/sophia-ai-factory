/**
 * Canonical AI Capability Model — Sophia AI Factory.
 *
 * Defines canonical AI capabilities and maps each supported provider
 * to its concrete functional capabilities. Used by setup wizard,
 * mission preflight, and execution router to guarantee that required
 * providers exist before attempting autonomous video/image missions.
 *
 * @module seed/ai/capability-model
 */

export type AICapability =
  | 'AI_TEXT'
  | 'AI_IMAGE'
  | 'AI_VIDEO'
  | 'AI_AUDIO'
  | 'AVATAR';

export const ALL_CAPABILITIES: readonly AICapability[] = [
  'AI_TEXT',
  'AI_IMAGE',
  'AI_VIDEO',
  'AI_AUDIO',
  'AVATAR',
] as const;

export const PROVIDER_CAPABILITIES: Record<string, readonly AICapability[]> = {
  openrouter: ['AI_TEXT'],
  anthropic: ['AI_TEXT'],
  elevenlabs: ['AI_AUDIO'],
  'd-id': ['AI_VIDEO', 'AVATAR'],
  heygen: ['AI_VIDEO', 'AVATAR'],
  replicate: ['AI_IMAGE', 'AI_VIDEO'],
  'fal-ai': ['AI_IMAGE'],
  muapi: ['AI_IMAGE', 'AI_VIDEO'],
  apollo: ['AI_TEXT'],
  hunter: ['AI_TEXT'],
};

export interface CapabilityResolution {
  availableCapabilities: AICapability[];
  missingCapabilities: AICapability[];
  providerCapabilities: Record<string, AICapability[]>;
  canGenerateText: boolean;
  canGenerateImage: boolean;
  canGenerateVideo: boolean;
  canGenerateAudio: boolean;
  canGenerateAvatar: boolean;
}

/**
 * Resolve which AI capabilities are currently available based on a set of active providers.
 */
export function resolveCapabilities(activeProviders: string[]): CapabilityResolution {
  const availableSet = new Set<AICapability>();
  const providerCaps: Record<string, AICapability[]> = {};

  for (const provider of activeProviders) {
    const normalized = provider.toLowerCase().trim();
    const caps = PROVIDER_CAPABILITIES[normalized];
    if (caps && caps.length > 0) {
      providerCaps[normalized] = [...caps];
      for (const cap of caps) {
        availableSet.add(cap);
      }
    } else {
      providerCaps[normalized] = [];
    }
  }

  const availableCapabilities = ALL_CAPABILITIES.filter((cap) => availableSet.has(cap));
  const missingCapabilities = ALL_CAPABILITIES.filter((cap) => !availableSet.has(cap));

  return {
    availableCapabilities,
    missingCapabilities,
    providerCapabilities: providerCaps,
    canGenerateText: availableSet.has('AI_TEXT'),
    canGenerateImage: availableSet.has('AI_IMAGE'),
    canGenerateVideo: availableSet.has('AI_VIDEO'),
    canGenerateAudio: availableSet.has('AI_AUDIO'),
    canGenerateAvatar: availableSet.has('AVATAR'),
  };
}

/**
 * Check if the given providers satisfy all required capabilities for a specific mission type.
 */
export function hasRequiredCapabilities(
  activeProviders: string[],
  required: AICapability[]
): boolean {
  const resolution = resolveCapabilities(activeProviders);
  const availableSet = new Set(resolution.availableCapabilities);
  return required.every((req) => availableSet.has(req));
}
