/**
 * @file mutation-engine.test.ts
 * @description Unit tests for Darwinian video gene mutation generator
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { mutateVideoGene } from '../mutation-engine';
import type { MutationGene } from '@/seed/types/creative-mutator-types';

describe('Tree Creative Mutation Engine', () => {
  const baseParentGene: MutationGene = {
    hookArchetype: 'STATISTIC_PAIN',
    hookScriptText: '83% of creators fail because they ignore this 1 metric.',
    visualStyle: 'Clean minimalist studio UI',
    cameraMotion: 'Subtle slow zoom-in',
    pacingMultiplier: 1.0,
    ctaText: 'Link in bio for full blueprint',
  };

  it('mutates gene conservatively with minor pacing compression', () => {
    const { offspringGene, delta } = mutateVideoGene(baseParentGene, 'CONSERVATIVE');

    expect(offspringGene.hookArchetype).toBe('POLARIZING_VERDICT');
    expect(offspringGene.pacingMultiplier).toBe(1.04);
    expect(delta.parentHookArchetype).toBe('STATISTIC_PAIN');
    expect(delta.offspringHookArchetype).toBe('POLARIZING_VERDICT');
    expect(delta.mutationIntensity).toBe('CONSERVATIVE');
  });

  it('mutates gene moderately with cinematic visuals and tempo shift', () => {
    const { offspringGene, delta } = mutateVideoGene(baseParentGene, 'MODERATE');

    expect(offspringGene.hookArchetype).toBe('FINANCIAL_LOSS_WARNING');
    expect(offspringGene.pacingMultiplier).toBe(1.08);
    expect(delta.visualShift).toContain('Clean minimalist studio UI');
    expect(delta.mutationIntensity).toBe('MODERATE');
  });

  it('mutates gene radically with inverted archetype and 1.15x tempo', () => {
    const { offspringGene, delta } = mutateVideoGene(baseParentGene, 'RADICAL');

    expect(offspringGene.hookArchetype).toBe('AUTOMATION_PROOF');
    expect(offspringGene.pacingMultiplier).toBe(1.15);
    expect(delta.mutationIntensity).toBe('RADICAL');
  });

  it('respects custom overrides when provided', () => {
    const { offspringGene, delta } = mutateVideoGene(baseParentGene, 'RADICAL', {
      targetHookArchetype: 'EXCLUSIVE_ACCESS',
      targetVisualStyle: 'Custom Cyberpunk Anime 3D',
      pacingMultiplier: 1.25,
    });

    expect(offspringGene.hookArchetype).toBe('EXCLUSIVE_ACCESS');
    expect(offspringGene.visualStyle).toBe('Custom Cyberpunk Anime 3D');
    expect(offspringGene.pacingMultiplier).toBe(1.25);
    expect(delta.pacingDelta).toBe(0.25);
  });
});
