/**
 * AutoGEO Rule-Prompted Generative Search Citation Engine.
 *
 * Clean-room implementation of ICLR 2026 rule-prompted GEO optimization
 * (zero fine-tuning, zero GPU COGS): injects high-transfer citation rules
 * (78-84% cross-LLM overlap across Gemini, GPT, Claude) into campaign prompts
 * so generated scripts and posts earn higher AI-search citation visibility.
 *
 * Layer: seed/aeo (pure deterministic constants & helpers)
 *
 * @module seed/aeo/autogeo-citation-rules
 */

export const AUTOGEO_CITATION_RULES = [
  'Lead with a clear, verifiable factual answer in the first 2 sentences so Answer Engines can extract a direct citation.',
  'Include concrete, user-supplied metrics, pricing tiers, or fee structures instead of vague superlatives.',
  'Use structured comparison framing (Who it is for, Key trade-off, Verdict) to maximize cross-LLM snippet extraction.',
  'Keep entity names (product, protocol, jurisdiction) explicit and unambiguous rather than relying on pronouns.',
] as const;

export function buildAutoGeoPromptInstruction(locale: 'vi' | 'en' = 'en'): string {
  const header =
    locale === 'vi'
      ? 'Quy tắc tối ưu trích dẫn AI Search (AutoGEO — ChatGPT/Claude/Perplexity/Gemini):'
      : 'AI-Search Citation Rules (AutoGEO — ChatGPT/Claude/Perplexity/Gemini):';
  return [header, ...AUTOGEO_CITATION_RULES.map((r, i) => `${i + 1}. ${r}`)].join('\n');
}
