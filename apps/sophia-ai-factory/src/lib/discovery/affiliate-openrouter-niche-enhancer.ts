/**
 * OpenRouter-powered semantic niche matching for affiliate programs.
 *
 * Degrades gracefully: returns null when OPENROUTER_API_KEY is not set
 * or when the API call fails. Callers should fall back to deterministic
 * scoring from affiliate-ai-scorer.ts.
 */

import type { AffiliateProgram } from "@/types";
import { withTimeout } from "@/lib/byok/with-timeout";
import { callLocalMekongd } from "@/lib/byok/local-mekongd-adapter";

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
 * Phase A "eat-own-dogfood": when SOPHIA_LOCAL_MEKONGD_URL is set, route
 * through local mekongd (founder's M1 Max via CF Tunnel) FIRST. On any
 * failure, fall through to the existing OpenRouter call path.
 */
export async function enhanceNicheScoreWithAI(
  program: AffiliateProgram,
  niche: string,
): Promise<number | null> {
  const prompt = buildPrompt(program, niche);

  // Local mekongd path (founder dogfood) — opt-in via env var.
  const localUrl = process.env.SOPHIA_LOCAL_MEKONGD_URL;
  if (localUrl) {
    const localText = await callLocalMekongd(prompt, {
      endpoint: localUrl,
      bearer: process.env.SOPHIA_LOCAL_MEKONGD_BEARER,
    });
    const localScore = parseScore(localText);
    if (localScore !== null) return localScore;
    // null → fall through to OpenRouter (silent fallback)
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await withTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
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
      return null;
    }

    const data = (await response.json()) as { choices?: OpenRouterChoice[] };
    return parseScore(data.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}
