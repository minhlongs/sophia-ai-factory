/**
 * Pure Domain Algorithm: Darwinian Hook Mutator
 * Generates semantic variants of viral hooks while maintaining minimum divergence.
 * Layer: tree/growth-v12 | Max LOC: < 200 | Zero :any
 * @module tree/growth-v12/hook-mutator
 */

import { FLYWHEEL_CONFIG } from '@/seed/config/growth/flywheel-weights';

export interface HookMutationResult {
  originalHook: string;
  mutatedHooks: string[];
  meanDivergence: number;
}

const MUTATION_TEMPLATES = [
  (hook: string) => `Dừng lại nếu bạn đang làm sai: ${hook.toLowerCase().replace(/^(top|bí quyết|cách)\s*/i, '')}`,
  (hook: string) => `99% người bỏ qua điều này: ${hook}`,
  (hook: string) => `Bí mật mà chuyên gia không muốn bạn biết: ${hook}`,
  (hook: string) => `Cách đơn giản nhất để áp dụng: ${hook}`,
];

export function calculateJaccardDivergence(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  const similarity = intersection.size / union.size;
  return 1 - similarity;
}

export function mutateViralHook(
  originalHook: string,
  variantCount: number = 3,
): HookMutationResult {
  const cleanOriginal = originalHook.trim();
  const variants: string[] = [];
  let totalDiv = 0;

  for (let i = 0; i < Math.min(variantCount, MUTATION_TEMPLATES.length); i++) {
    const candidate = MUTATION_TEMPLATES[i](cleanOriginal).trim();
    const div = calculateJaccardDivergence(cleanOriginal, candidate);
    if (div >= FLYWHEEL_CONFIG.MIN_HOOK_DIVERGENCE_DISTANCE) {
      variants.push(candidate);
      totalDiv += div;
    }
  }

  const meanDivergence = variants.length > 0 ? Math.round((totalDiv / variants.length) * 100) / 100 : 0;

  return {
    originalHook: cleanOriginal,
    mutatedHooks: variants,
    meanDivergence,
  };
}
