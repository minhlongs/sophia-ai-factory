/**
 * OpenRouter BYOK LLM Callback Builder for Playbook Guideline Generation
 * @module forest/patterns/guideline-llm-builder
 */

/**
 * Build an OpenRouter BYOK LLM callback for rule generation.
 * Reuses the resilient client from Phase 4 — never throws, returns null on
 * any failure so the caller falls back to template rules.
 */
export function buildPlaybookLlm(
  userId: string,
): (prompt: string) => Promise<string | null> {
  return async (prompt: string): Promise<string | null> => {
    try {
      const [{ resolveUserApiKey }, { resilientChatCompletion }] = await Promise.all([
        import('@/tree/byok/resolve-user-api-key'),
        import('@/seed/inference/openrouter-client'),
      ]);
      const apiKey = await resolveUserApiKey(userId, 'openrouter', process.env.OPENROUTER_API_KEY);
      const anthropicKey = process.env.ANTHROPIC_API_KEY ?? undefined;
      if (!apiKey && !anthropicKey) return null;
      return await resilientChatCompletion(prompt, {
        openRouterKey: apiKey,
        anthropicKey,
        enableFallback: !!anthropicKey,
      });
    } catch {
      return null;
    }
  };
}
