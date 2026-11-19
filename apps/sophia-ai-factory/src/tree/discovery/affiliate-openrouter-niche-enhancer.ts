/**
 * OpenRouter-powered semantic niche matching for affiliate programs.
 *
 * Degrades gracefully: returns null when OPENROUTER_API_KEY is not set
 * or when the API call fails. Callers should fall back to deterministic
 * scoring from affiliate-ai-scorer.ts.
 */

import type { AffiliateProgram } from "@/seed/types";
import { classifyError, classifyHttpStatus } from "@/seed/types/failure-kind";
import { withTimeout } from "@/tree/byok/with-timeout";
import { resolveUserApiKey } from "@/tree/byok/resolve-user-api-key";
import { recordTieredRouteOutcome, selectTieredByokRoute } from "@/tree/byok/tiered-byok-router";

/** OpenRouter response shape for chat completions */
interface OpenRouterChoice {
  message: { content: string };
}

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

  // Fail closed to customer BYOK — never silently fall back to platform OPENROUTER_API_KEY.
  const apiKey = await resolveUserApiKey(userId ?? null, "openrouter");
  if (!apiKey) return null;

  const keyRef = userId ?? "platform-default";
  const route = selectTieredByokRoute({
    taskKind: "qa_validation",
    baselineModel: "openai/gpt-4o-mini",
    keyRef,
  });
  if (!route.resilientAllowed) return null;

  try {
    const response = await withTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: route.model,
        messages: [
          {
            role: "system",
            content: "You are a niche-matching analyst. Return ONLY a number 0-100.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 10,
      }),
      provider: 'openrouter',
    });

    if (!response.ok) {
      recordTieredRouteOutcome({
        keyRef,
        model: route.model,
        ok: false,
        failureKind: classifyHttpStatus(response.status),
      });
      return null;
    }
    recordTieredRouteOutcome({ keyRef, model: route.model, ok: true });

    const data = (await response.json()) as { choices?: OpenRouterChoice[] };
    return parseScore(data.choices?.[0]?.message?.content);
  } catch (err) {
    recordTieredRouteOutcome({
      keyRef,
      model: route.model,
      ok: false,
      failureKind: classifyError(err),
    });
    return null;
  }
}
