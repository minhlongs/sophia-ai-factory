/**
 * @module seed/config/fal-pricing
 *
 * Static fal.ai model pricing (per-image cost in USD cents) with an
 * env-overridable price table. Fal.ai does NOT return cost in the API
 * response — cost is computed client-side from the model ID.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 *
 * Pricing source: fal.ai published rates (as of 2026-08-31).
 * - fal-ai/flux-schnell: $0.01/image (4 steps)
 * - fal-ai/flux/dev:     $0.025/image → rounded UP to 3¢
 * - fal-ai/flux-pro:     $0.05/image
 *
 * Fractional-cent prices are rounded UP to the nearest whole cent and
 * documented here so the rounding policy is auditable.
 *
 * Override: set `FAL_PRICING_JSON` env var to a JSON object mapping
 * model IDs to integer cents, e.g. '{"fal-ai/flux-schnell":1}'. Malformed
 * env falls back to the static table (logged, never throws).
 */

import { z } from 'zod';

// ── Static fallback (cents) ──────────────────────────────────────────────────

export const DEFAULT_FAL_PRICING: Readonly<Record<string, number>> = {
  'fal-ai/flux-schnell': 1, // $0.01
  'fal-ai/flux/dev': 3, // $0.025 → round UP to 3¢
  'fal-ai/flux-pro': 5, // $0.05
};

// ── Env override (parsed once, cached) ───────────────────────────────────────

const FalPricingSchema = z.record(z.string(), z.number().int().nonnegative());

let cachedPricing: Readonly<Record<string, number>> | null = null;

function resolvePricingTable(): Readonly<Record<string, number>> {
  if (cachedPricing) return cachedPricing;

  const raw = process.env.FAL_PRICING_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const result = FalPricingSchema.safeParse(parsed);
      if (result.success) {
        cachedPricing = Object.freeze({ ...result.data });
        return cachedPricing;
      }
      // Malformed env — fall back to static, warn once.
      // eslint-disable-next-line no-console
      console.warn('[fal-pricing] malformed FAL_PRICING_JSON — using static pricing table');
    } catch {
      // JSON.parse failure — fall back to static, warn once.
      // eslint-disable-next-line no-console
      console.warn('[fal-pricing] failed to parse FAL_PRICING_JSON — using static pricing table');
    }
  }

  cachedPricing = Object.freeze({ ...DEFAULT_FAL_PRICING });
  return cachedPricing;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the per-image cost in cents for a fal.ai model, or `undefined`
 * if the model is not in the price table. Never throws, never guesses.
 */
export function getFalModelPriceCents(modelId: string): number | undefined {
  const table = resolvePricingTable();
  return table[modelId];
}
