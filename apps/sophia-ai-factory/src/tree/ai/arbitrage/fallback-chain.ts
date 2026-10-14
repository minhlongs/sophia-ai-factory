import type { PipelineStage } from '@/seed/types/unit-economics-types';

export const DEFAULT_FALLBACK_CHAINS: Record<PipelineStage, Record<string, string[]>> = {
  script: {
    mekong: ['openrouter', 'anthropic'],
    openrouter: ['anthropic', 'mekong'],
    anthropic: ['openrouter', 'mekong'],
  },
  visuals: {
    mekong: ['fal', 'cloud_flux_dev'],
    fal: ['mekong', 'cloud_flux_dev'],
    cloud_flux_dev: ['fal', 'mekong'],
  },
  audio: {
    mekong: ['elevenlabs', 'fish-speech'],
    elevenlabs: ['fish-speech', 'mekong'],
    'fish-speech': ['elevenlabs', 'mekong'],
  },
  render: {
    mekong: ['openrouter', 'fal'],
    openrouter: ['fal', 'mekong'],
    fal: ['openrouter', 'mekong'],
  },
};

/**
 * Returns ordered list of fallback providers for a given stage and primary provider.
 */
export function getFallbackChain(stage: PipelineStage, primaryProvider: string): string[] {
  const stageChains = DEFAULT_FALLBACK_CHAINS[stage];
  if (stageChains && stageChains[primaryProvider]) {
    return stageChains[primaryProvider];
  }
  // Generic fallback if provider not explicitly mapped
  return ['openrouter', 'fal', 'elevenlabs'].filter((p) => p !== primaryProvider);
}
