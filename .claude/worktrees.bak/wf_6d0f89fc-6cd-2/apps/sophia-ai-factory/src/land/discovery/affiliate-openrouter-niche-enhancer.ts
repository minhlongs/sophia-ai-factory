/**
 * OpenRouter-powered semantic niche matching for affiliate programs.
 *
 * Degrades gracefully: returns null when OpenRouter key is not set
 * or when the API call fails. Callers should fall back to deterministic
 * scoring from affiliate-ai-scorer.ts.
 */

import type { AffiliateProgram } from "@/seed/types";
import { resolveUserApiKey } from "@/tree/byok/resolve-user-api-key";
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';

/** Build the user-content prompt — shared between local + cloud paths so
 *  the model sees identical input regardless of which backend served it. */
function buildPrompt(program: AffiliateProgram, niche: string): string {
  return `Rate how well this affiliate program matches the niche "${niche}" (0-100):\nName: ${program.name}\nCategory: ${program.category}\nDescription: ${program.description ?? "N/A"}`;
}

/** Coerce model output ("85", " 85\n", "85 / 100", etc.) to a clamped 0-100 int.
 *  Returns null if no number could be parsed — caller falls back accordingly. */
function parseScore(text: string | null | undefined): number | null {
  if (!text) return null;
  const score = parseInt(text.trim(), 10);
  return Number.isFinite(score) ? Math.min(Math.max(score, 0), 100) : null;
}

/**
 * Enhance a program's niche score using OpenRouter semantic analysis.
 * Returns an AI-generated relevance score (0-100) or null if unavailable.
 *
 * Resolution order (priority high → low):
 *   1. OpenRouter cloud (BYOK or env fallback)
 *
 * @param program  Affiliate program to score
 * @param niche    Target niche string
 * @param userId   Optional auth user ID — enables per-user BYOK routing (default: undefined)
 */
export async function enhanceNicheScoreWithAI(
  program: AffiliateProgram,
  niche: string,
  userId?: string,
): Promise<number | null> {
  const prompt = buildPrompt(program, niche);

  // BYOK-aware — prefer user's stored OpenRouter key; fall back to env.
  const apiKey = await resolveUserApiKey(
    userId ?? null,
    "openrouter",
    process.env.OPENROUTER_API_KEY,
  );
  if (!apiKey) return null;

  try {
    const content = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey: undefined,
      enableFallback: false,
      model: 'openai/gpt-4o-mini',
    });
    return parseScore(content);
  } catch {
    return null;
  }
}
