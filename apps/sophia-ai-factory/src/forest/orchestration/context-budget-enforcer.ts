import { Turn } from './context-state-manager';

export class ContextBudgetEnforcer {
  /**
   * Technical enforcement of token limits for the Orchestrator's bounded context model.
   * This prevents monotonic growth of prompts that lead to context window overflow.
   */
  static readonly HARD_CEILING = 240_000;
  static readonly WARNING_THRESHOLD = 200_000;
  static readonly CRITICAL_THRESHOLD = 230_000;
  static readonly MAX_HISTORY_TURNS = 3;
  static readonly MAX_SUMMARY_TOKENS = 500;

  /**
   * Basic token estimation.
   * Since a precise tokenizer is usually external, we use the industry standard
   * heuristic of ~4 characters per token for English/Code.
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  static checkBudget(currentTokens: number): { status: 'ok' | 'warning' | 'critical' | 'overflow' } {
    if (currentTokens >= this.HARD_CEILING) return { status: 'overflow' };
    if (currentTokens >= this.CRITICAL_THRESHOLD) return { status: 'critical' };
    if (currentTokens >= this.WARNING_THRESHOLD) return { status: 'warning' };
    return { status: 'ok' };
  }

  /**
   * Trims the conversation history to the last N turns to keep the prompt bounded.
   */
  static trimHistory(turns: Turn[], maxTurns: number): Turn[] {
    if (turns.length <= maxTurns) return turns;
    return turns.slice(-maxTurns);
  }

  /**
   * Compresses a set of turns into a concise summary string.
   * This avoids losing complete context when trimming history.
   */
  static compressToSummary(turns: Turn[]): string {
    if (turns.length === 0) return 'No history yet.';

    const summary = turns
      .map((t, i) => `[Turn ${i + 1} - ${t.role}]: ${t.content.substring(0, 100)}${t.content.length > 100 ? '...' : ''}`)
      .join(' | ');

    return `Conversation Summary: ${summary}`;
  }

  /**
   * Nuclear option: drops the oldest 50% of history when compression fails to meet budget.
   * Prevents death-loops where summaries are still too large.
   */
  static emergencyPurge(turns: Turn[]): { kept: Turn[]; purged: Turn[] } {
    if (turns.length === 0) return { kept: [], purged: [] };
    const splitIndex = Math.floor(turns.length / 2);
    return {
      purged: turns.slice(0, splitIndex),
      kept: turns.slice(splitIndex),
    };
  }

  /**
   * Estimates tokens for the system prompt / seed context.
   */
  static seedBudgetUsage(systemPrompt: string): number {
    return this.estimateTokens(systemPrompt);
  }

  /**
   * Validates that the initial seed context doesn't consume too much of the budget.
   * Throws if seed exceeds 60% of the provided safeLimit.
   */
  static checkSeedBudget(systemPrompt: string, safeLimit: number): void {
    const usage = this.seedBudgetUsage(systemPrompt);
    if (usage > safeLimit * 0.6) {
      throw new Error(`System prompt budget exceeded: ${usage} tokens is > 60% of ${safeLimit}. Please optimize the seed prompt.`);
    }
  }
}
