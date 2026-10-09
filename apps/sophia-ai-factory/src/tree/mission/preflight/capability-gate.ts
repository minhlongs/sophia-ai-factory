/**
 * Production-Safe Mission Preflight Checklist: Capability Gate.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/capability-gate
 */

import {
  resolveCapabilities,
  type AICapability,
} from '@/seed/ai/capability-model';
import type { ByokProvider } from '@/tree/byok/user-api-key-store';
import type { MissionPreflightOptions, PreflightGateEvaluation } from './types';

export const EXTENDED_PROVIDER_CAPABILITIES: Record<string, readonly AICapability[]> = {
  kling: ['AI_VIDEO'],
  'kling-video': ['AI_VIDEO'],
  hunyuan: ['AI_VIDEO'],
  'hunyuan-video': ['AI_VIDEO'],
};

export function resolveExtendedCapabilities(activeProviders: string[]): {
  availableCapabilities: AICapability[];
  missingCapabilities: AICapability[];
} {
  const base = resolveCapabilities(activeProviders);
  const availableSet = new Set<AICapability>(base.availableCapabilities);

  for (const provider of activeProviders) {
    const norm = provider.toLowerCase().trim();
    const extra = EXTENDED_PROVIDER_CAPABILITIES[norm];
    if (extra) {
      for (const cap of extra) {
        availableSet.add(cap);
      }
    }
  }

  const availableCapabilities = Array.from(availableSet);
  const missingCapabilities = (['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO', 'AVATAR'] as AICapability[]).filter(
    (cap) => !availableSet.has(cap)
  );

  return { availableCapabilities, missingCapabilities };
}

export function evaluateCapabilityGate(
  configuredProviders: ByokProvider[],
  opts: MissionPreflightOptions
): PreflightGateEvaluation {
  const { availableCapabilities } = resolveExtendedCapabilities(configuredProviders);

  // If composite requiredCapabilities is specified
  if (opts.requiredCapabilities && opts.requiredCapabilities.length > 0) {
    const missingCapabilities = opts.requiredCapabilities.filter(
      (cap) => !availableCapabilities.includes(cap)
    );

    if (missingCapabilities.length > 0) {
      return {
        passed: false,
        gate: {
          passed: false,
          code: 'CAPABILITY_NOT_SUPPORTED',
          message: `Configured providers (${configuredProviders.join(', ') || 'none'}) do not support required capabilities: ${missingCapabilities.join(', ')}`,
          details: {
            requiredCapabilities: opts.requiredCapabilities,
            missingCapabilities,
            configuredProviders,
            availableCapabilities,
          },
        },
      };
    }

    return {
      passed: true,
      gate: {
        passed: true,
        code: 'CAPABILITY_OK',
        message: `Configured providers support all required capabilities: ${opts.requiredCapabilities.join(', ')}`,
        details: {
          requiredCapabilities: opts.requiredCapabilities,
          availableCapabilities,
        },
      },
    };
  }

  // Fallback: single capability check (default: AI_IMAGE)
  const targetCapability: AICapability = opts.capability ?? 'AI_IMAGE';
  const capabilitySupported = availableCapabilities.includes(targetCapability);

  if (!capabilitySupported) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Configured providers (${configuredProviders.join(', ') || 'none'}) do not support required capability: ${targetCapability}`,
        details: {
          targetCapability,
          configuredProviders,
          availableCapabilities,
        },
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'CAPABILITY_OK',
      message: `Capability ${targetCapability} is supported by configured providers`,
      details: { targetCapability, availableCapabilities },
    },
  };
}
