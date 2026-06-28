/**
 * Visual Router
 *
 * Maps tenant tier to visual generation path:
 * - 'free' | 'pro'   → 'template' (Path A: MoviePy, cheap + fast)
 * - 'enterprise'     → 'cinematic' (Path B: HunyuanVideo on Runpod, GPU)
 */

export type VisualTier = 'free' | 'pro' | 'enterprise';
export type VisualPath = 'template' | 'cinematic';

/**
 * Route visual generation path based on tenant tier.
 * free/pro → template ($0.20-0.50/video, <60s)
 * enterprise → cinematic ($5-15/video, <8min)
 */
export function routeVisualPath(tier: VisualTier): VisualPath {
  if (tier === 'enterprise') return 'cinematic';
  return 'template';
}
