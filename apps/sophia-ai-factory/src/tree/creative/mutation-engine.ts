/**
 * @file mutation-engine.ts
 * @description Pure Darwinian mutation generator for short-form video genes
 * @layer tree
 */

import type {
  MutationGene,
  MutationDelta,
  MutationIntensity,
  HookArchetype,
} from '@/seed/types/creative-mutator-types';

const HOOK_ARCHETYPE_TEMPLATES: Record<HookArchetype, string[]> = {
  STATISTIC_PAIN: [
    '83% of creators fail because they ignore this 1 metric.',
    'Over 70% of SaaS budgets are completely wasted here.',
  ],
  POLARIZING_VERDICT: [
    'Stop using traditional video workflows in 2026. You are burning money.',
    'Everyone is wrong about short-form retention. Here is the truth.',
  ],
  FINANCIAL_LOSS_WARNING: [
    'You are actively leaking $1,200 every week without realizing it.',
    'This unseen cost is destroying your monthly margin right now.',
  ],
  AUTOMATION_PROOF: [
    'Watch this autonomous pipeline generate 30 videos in under 12 seconds.',
    'I automated my entire content engine with this single architecture.',
  ],
  HIGH_CURIOSITY_LIST: [
    '3 underground growth strategies top agencies refuse to share.',
    'The top 5 automation shifts nobody on LinkedIn is talking about.',
  ],
  EXCLUSIVE_ACCESS: [
    'Here is the exact confidential prompt stack used by top 1% studios.',
    'This leaked blueprint reveals why their hooks convert at 80%+.',
  ],
};

const VISUAL_MOTION_STYLES: Record<MutationIntensity, { style: string; motion: string }[]> = {
  CONSERVATIVE: [
    { style: 'Clean minimalist studio UI', motion: 'Subtle slow zoom-in' },
    { style: 'Crisp product screen recording', motion: 'Smooth steady pan' },
  ],
  MODERATE: [
    { style: 'Cinematic fast-cut B-roll', motion: 'Dynamic push-in with macro focus' },
    { style: 'High-contrast neo-tech graphic', motion: 'Whip-pan transition with slide' },
  ],
  RADICAL: [
    { style: 'Cyberpunk neon hyper-lapse', motion: 'Kinetic glitch cut with snap zoom' },
    { style: 'Photorealistic high-drama macro', motion: 'Rapid 360 orbital camera rotation' },
  ],
};

const PACING_FACTORS: Record<MutationIntensity, number> = {
  CONSERVATIVE: 1.04,
  MODERATE: 1.08,
  RADICAL: 1.15,
};

export function mutateVideoGene(
  parent: MutationGene,
  intensity: MutationIntensity,
  overrides?: {
    targetHookArchetype?: HookArchetype;
    targetVisualStyle?: string;
    pacingMultiplier?: number;
  },
): { offspringGene: MutationGene; delta: MutationDelta } {
  const targetArchetype: HookArchetype =
    overrides?.targetHookArchetype ?? getNextArchetype(parent.hookArchetype, intensity);

  const scriptOptions = HOOK_ARCHETYPE_TEMPLATES[targetArchetype];
  const hookScriptText = scriptOptions[0] ?? parent.hookScriptText;

  const visualProfiles = VISUAL_MOTION_STYLES[intensity];
  const selectedVisual = visualProfiles[0];
  const visualStyle = overrides?.targetVisualStyle ?? selectedVisual.style;
  const cameraMotion = selectedVisual.motion;

  const pacingFactor = PACING_FACTORS[intensity];
  const calculatedPacing = Math.round(Math.min(1.3, parent.pacingMultiplier * pacingFactor) * 100) / 100;
  const pacingMultiplier = overrides?.pacingMultiplier ?? calculatedPacing;

  const offspringGene: MutationGene = {
    hookArchetype: targetArchetype,
    hookScriptText,
    visualStyle,
    cameraMotion,
    pacingMultiplier,
    ctaText: parent.ctaText,
  };

  const delta: MutationDelta = {
    parentHookArchetype: parent.hookArchetype,
    offspringHookArchetype: targetArchetype,
    visualShift: `${parent.visualStyle} -> ${visualStyle}`,
    pacingDelta: Math.round((pacingMultiplier - parent.pacingMultiplier) * 100) / 100,
    mutationIntensity: intensity,
  };

  return { offspringGene, delta };
}

function getNextArchetype(current: HookArchetype, intensity: MutationIntensity): HookArchetype {
  const archetypes: HookArchetype[] = [
    'STATISTIC_PAIN',
    'POLARIZING_VERDICT',
    'FINANCIAL_LOSS_WARNING',
    'AUTOMATION_PROOF',
    'HIGH_CURIOSITY_LIST',
    'EXCLUSIVE_ACCESS',
  ];
  const currentIndex = archetypes.indexOf(current);
  const shift = intensity === 'CONSERVATIVE' ? 1 : intensity === 'MODERATE' ? 2 : 3;
  const nextIndex = (currentIndex + shift) % archetypes.length;
  return archetypes[nextIndex];
}
