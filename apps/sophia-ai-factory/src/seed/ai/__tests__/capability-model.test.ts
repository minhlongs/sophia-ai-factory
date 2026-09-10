/**
 * BYOK Capability Model & Validation Tests
 *
 * Tests:
 * 1. Provider capability resolution for single and multiple providers
 * 2. Missing capability detection
 * 3. Required capabilities check for mission preflight
 * 4. Replicate and fal-ai capability mapping
 *
 * @module seed/ai/__tests__/capability-model.test
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCapabilities,
  hasRequiredCapabilities,
  ALL_CAPABILITIES,
  PROVIDER_CAPABILITIES,
  type AICapability,
} from '@/seed/ai/capability-model';

describe('AI Capability Model', () => {
  it('defines 5 canonical capabilities', () => {
    expect(ALL_CAPABILITIES).toEqual([
      'AI_TEXT',
      'AI_IMAGE',
      'AI_VIDEO',
      'AI_AUDIO',
      'AVATAR',
    ]);
  });

  it('maps fal-ai strictly to AI_IMAGE', () => {
    expect(PROVIDER_CAPABILITIES['fal-ai']).toEqual(['AI_IMAGE']);
  });

  it('maps replicate to AI_IMAGE and AI_VIDEO', () => {
    expect(PROVIDER_CAPABILITIES['replicate']).toEqual(['AI_IMAGE', 'AI_VIDEO']);
  });

  it('resolves empty capabilities when no providers configured', () => {
    const res = resolveCapabilities([]);
    expect(res.availableCapabilities).toEqual([]);
    expect(res.missingCapabilities).toEqual([...ALL_CAPABILITIES]);
    expect(res.canGenerateText).toBe(false);
    expect(res.canGenerateImage).toBe(false);
    expect(res.canGenerateVideo).toBe(false);
    expect(res.canGenerateAudio).toBe(false);
    expect(res.canGenerateAvatar).toBe(false);
  });

  it('resolves text capabilities for openrouter', () => {
    const res = resolveCapabilities(['openrouter']);
    expect(res.canGenerateText).toBe(true);
    expect(res.canGenerateAudio).toBe(false);
    expect(res.availableCapabilities).toEqual(['AI_TEXT']);
    expect(res.missingCapabilities).toContain('AI_IMAGE');
    expect(res.missingCapabilities).toContain('AI_VIDEO');
    expect(res.missingCapabilities).toContain('AI_AUDIO');
    expect(res.missingCapabilities).toContain('AVATAR');
  });

  it('resolves full suite of capabilities with recommended provider stack', () => {
    const res = resolveCapabilities(['openrouter', 'elevenlabs', 'fal-ai', 'd-id']);
    expect(res.canGenerateText).toBe(true);
    expect(res.canGenerateAudio).toBe(true);
    expect(res.canGenerateImage).toBe(true);
    expect(res.canGenerateVideo).toBe(true);
    expect(res.canGenerateAvatar).toBe(true);
    expect(res.missingCapabilities).toEqual([]);
  });

  it('validates hasRequiredCapabilities accurately', () => {
    const videoRequirements: AICapability[] = ['AI_TEXT', 'AI_AUDIO', 'AI_VIDEO'];

    // Incomplete stack
    expect(hasRequiredCapabilities(['openrouter'], videoRequirements)).toBe(false);
    expect(hasRequiredCapabilities(['openrouter', 'elevenlabs'], videoRequirements)).toBe(false);

    // Complete stack with replicate
    expect(hasRequiredCapabilities(['openrouter', 'elevenlabs', 'replicate'], videoRequirements)).toBe(true);

    // Complete stack with d-id
    expect(hasRequiredCapabilities(['anthropic', 'elevenlabs', 'd-id'], videoRequirements)).toBe(true);
  });
});
