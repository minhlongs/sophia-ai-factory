/**
 * OpenRouter-powered semantic niche matching for affiliate programs.
 *
 * Degrades gracefully: returns null when OPENROUTER_API_KEY is not set
 * or when the API call fails. Callers should fall back to deterministic
 * scoring from affiliate-ai-scorer.ts.
 */

import type { AffiliateProgram } from "@/types";

/** OpenRouter response shape for chat completions */
interface OpenRouterChoice {
  message: { content: string };
}

/**
 * Enhance a program's niche score using OpenRouter semantic analysis.
 * Returns an AI-generated relevance score (0-100) or null if unavailable.
 */
export async function enhanceNicheScoreWithAI(
  program: AffiliateProgram,
  niche: string,
): Promise<number | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content: `Rate how well this affiliate program matches the niche "${niche}" (0-100):\nName: ${program.name}\nCategory: ${program.category}\nDescription: ${program.description ?? "N/A"}`,
          },
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { choices?: OpenRouterChoice[] };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    const score = parseInt(content, 10);
    return Number.isFinite(score) ? Math.min(Math.max(score, 0), 100) : null;
  } catch (err) {
    return null;
  }
}
