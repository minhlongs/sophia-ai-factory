# Phase 7: Memory Consolidation — Detailed Design
**Status:** shipped

## 1. Context Manager

**File:** `src/forest/agent-chat/context-manager.ts`  
**Layer:** forest (infrastructure orchestrator — manages cross-cutting concern for agent-chat)

### Interfaces

```typescript
/** Trimming strategy for context window management */
export type TrimmingStrategy = 'sliding-window' | 'summarization' | 'importance';

/** Configuration for the context manager */
export interface ContextManagerConfig {
  /** Max tokens allowed in context window (default: provider-specific) */
  maxContextTokens: number;
  /** Reserve tokens for the LLM response (default: 4096) */
  reservedOutputTokens: number;
  /** Strategy to use when trimming is needed */
  strategy: TrimmingStrategy;
  /** Minimum messages to keep (sliding window) */
  minMessagesKept: number;
  /** Whether summarization is enabled */
  enableSummarization: boolean;
  /** Threshold at which summarization triggers (0.0–1.0 of max) */
  summarizationThreshold: number;
}

/** Result of a context trim operation */
export interface TrimResult {
  trimmed: boolean;
  messagesKept: number;
  messagesRemoved: number;
  summary?: string;        // present when summarization produced one
  tokensBefore: number;
  tokensAfter: number;
}

/** Importance score for a message (used by importance-based retention) */
export interface MessageImportance {
  messageIndex: number;
  score: number;           // 0.0–1.0
  reason?: string;
}
```

### Implementation

```typescript
export class ContextManager {
  constructor(
    private config: ContextManagerConfig,
    private tokenCounter: TokenCounter,
    private summarizer?: ConversationSummarizer,
    private memory?: MemoryAdapter,  // for persisting summaries
  ) {}

  /**
   * Check if messages fit within context window.
   * Returns true if no trimming needed.
   */
  async fitsInContext(messages: ChatMessage[], modelId: string): Promise<boolean> {
    const tokens = this.tokenCounter.countMessages(messages, modelId);
    const limit = this.config.maxContextTokens - this.config.reservedOutputTokens;
    return tokens <= limit;
  }

  /**
   * Trim messages to fit within context window using configured strategy.
   * If summarization is used and a summary is produced, it is injected
   * as a system message at the beginning of the returned array.
   */
  async trim(
    messages: ChatMessage[],
    modelId: string,
    tenantId: string,
  ): Promise<{ messages: ChatMessage[]; result: TrimResult }> {
    const totalTokens = this.tokenCounter.countMessages(messages, modelId);
    const limit = this.config.maxContextTokens - this.config.reservedOutputTokens;

    if (totalTokens <= limit) {
      return { messages, result: { trimmed: false, messagesKept: messages.length, messagesRemoved: 0, tokensBefore: totalTokens, tokensAfter: totalTokens } };
    }

    switch (this.config.strategy) {
      case 'sliding-window':
        return this.trimSlidingWindow(messages, modelId, limit);
      case 'summarization':
        return this.trimWithSummarization(messages, modelId, limit, tenantId);
      case 'importance':
        return this.trimByImportance(messages, modelId, limit);
      default:
        return this.trimSlidingWindow(messages, modelId, limit);
    }
  }

  private async trimSlidingWindow(
    messages: ChatMessage[],
    modelId: string,
    limit: number,
  ): Promise<{ messages: ChatMessage[]; result: TrimResult }> {
    // Always keep the system message (index 0) if present
    const systemMsg = messages[0]?.role === 'system' ? messages[0] : null;
    const conversation = systemMsg ? messages.slice(1) : messages;

    // Walk from the end, keeping messages until we hit the limit
    const kept: ChatMessage[] = [];
    let tokens = systemMsg ? this.tokenCounter.countMessages([systemMsg], modelId) : 0;

    for (let i = conversation.length - 1; i >= 0; i--) {
      const msgTokens = this.tokenCounter.countMessages([conversation[i]], modelId);
      if (tokens + msgTokens > limit && kept.length >= this.config.minMessagesKept) break;
      kept.unshift(conversation[i]);
      tokens += msgTokens;
    }

    const resultMessages = systemMsg ? [systemMsg, ...kept] : kept;
    const result: TrimResult = {
      trimmed: true,
      messagesKept: resultMessages.length,
      messagesRemoved: messages.length - resultMessages.length,
      tokensBefore: this.tokenCounter.countMessages(messages, modelId),
      tokensAfter: this.tokenCounter.countMessages(resultMessages, modelId),
    };
    return { messages: resultMessages, result };
  }

  private async trimWithSummarization(
    messages: ChatMessage[],
    modelId: string,
    limit: number,
    tenantId: string,
  ): Promise<{ messages: ChatMessage[]; result: TrimResult }> {
    // First, do a sliding-window trim to get under 2x limit
    const twoXLimit = limit * 2;
    const { messages: preTrimmed } = await this.trimSlidingWindow(messages, modelId, twoXLimit);

    // Then summarize the removed portion
    const systemMsg = preTrimmed[0]?.role === 'system' ? preTrimmed[0] : null;
    const conversation = systemMsg ? preTrimmed.slice(1) : preTrimmed;

    // Split: keep recent half, summarize older half
    const keepCount = Math.max(this.config.minMessagesKept, Math.floor(conversation.length / 2));
    const toKeep = conversation.slice(-keepCount);
    const toSummarize = conversation.slice(0, conversation.length - keepCount);

    let summary: string | undefined;
    if (toSummarize.length > 0 && this.summarizer) {
      summary = await this.summarizer.summarize(toSummarize, modelId);
      // Persist summary to memory
      if (this.memory && summary) {
        await this.memory.store('session', 'last-summary', { summary, messageCount: toSummarize.length, createdAt: Date.now() }, tenantId);
      }
    }

    const summaryMsg: ChatMessage | undefined = summary
      ? { role: 'system', content: `[Previous conversation summary]\n${summary}` }
      : undefined;

    const resultMessages = [
      ...(systemMsg ? [systemMsg] : []),
      ...(summaryMsg ? [summaryMsg] : []),
      ...toKeep,
    ];

    const result: TrimResult = {
      trimmed: true,
      messagesKept: resultMessages.length,
      messagesRemoved: messages.length - resultMessages.length,
      summary,
      tokensBefore: this.tokenCounter.countMessages(messages, modelId),
      tokensAfter: this.tokenCounter.countMessages(resultMessages, modelId),
    };
    return { messages: resultMessages, result };
  }

  private async trimByImportance(
    messages: ChatMessage[],
    modelId: string,
    limit: number,
  ): Promise<{ messages: ChatMessage[]; result: TrimResult }> {
    // Score each message by heuristics (user questions > assistant responses > system)
    const systemMsg = messages[0]?.role === 'system' ? messages[0] : null;
    const conversation = systemMsg ? messages.slice(1) : messages;

    const scored: MessageImportance[] = conversation.map((msg, idx) => {
      let score = 0.5; // baseline
      if (msg.role === 'user') score += 0.2; // user messages tend to contain key info
      if (msg.role === 'system') score += 0.3;
      // Longer messages may contain more context
      if (msg.content.length > 200) score += 0.1;
      // Recent messages are more important (recency bias)
      const recency = idx / conversation.length;
      score += recency * 0.2;
      return { messageIndex: idx, score: Math.min(1.0, score) };
    });

    // Sort by importance descending, greedily add until limit
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const keptIndices = new Set<number>();
    let tokens = systemMsg ? this.tokenCounter.countMessages([systemMsg], modelId) : 0;

    for (const entry of sorted) {
      const msgTokens = this.tokenCounter.countMessages([conversation[entry.messageIndex]], modelId);
      if (tokens + msgTokens > limit) break;
      keptIndices.add(entry.messageIndex);
      tokens += msgTokens;
    }

    // Preserve original order
    const kept = conversation.filter((_, idx) => keptIndices.has(idx));
    const resultMessages = systemMsg ? [systemMsg, ...kept] : kept;
    const result: TrimResult = {
      trimmed: true,
      messagesKept: resultMessages.length,
      messagesRemoved: messages.length - resultMessages.length,
      tokensBefore: this.tokenCounter.countMessages(messages, modelId),
      tokensAfter: this.tokenCounter.countMessages(resultMessages, modelId),
    };
    return { messages: resultMessages, result };
  }
}
```

## 2. Conversation Summarizer

**File:** `src/forest/agent-chat/conversation-summarizer.ts`  
**Layer:** forest (uses llm-router to call LLM — orchestration)

### Interfaces

```typescript
export interface SummarizerConfig {
  /** System prompt for the summarization LLM call */
  systemPrompt?: string;
  /** Max tokens for the summary response */
  maxSummaryTokens: number;
  /** Temperature for summary generation (low = deterministic) */
  temperature: number;
}

export interface SummaryResult {
  summary: string;
  messagesSummarized: number;
  tokensUsed: number;
  providerUsed: string;
}
```

### Implementation

```typescript
export class ConversationSummarizer {
  constructor(
    private config: SummarizerConfig,
    private llmRouter: typeof import('@/forest/agent-chat/llm-router').resolveLlmRoute,
  ) {}

  /**
   * Summarize an array of chat messages into a compact paragraph.
   * Uses the configured LLM provider via llm-router.
   */
  async summarize(messages: ChatMessage[], modelId: string): Promise<string> {
    const route = await this.llmRouter('system'); // resolve route (no user context needed)
    if (!route) throw new Error('No LLM provider configured for summarization');

    const summaryPrompt = this.buildSummaryPrompt(messages);
    const response = await fetch(`${route.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${route.apiKey}`,
      },
      body: JSON.stringify({
        model: route.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt ?? DEFAULT_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: summaryPrompt },
        ],
        max_tokens: this.config.maxSummaryTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Summarization LLM call failed: ${response.status}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '(empty summary)';
  }

  private buildSummaryPrompt(messages: ChatMessage[]): string {
    const lines = messages.map((m) => `[${m.role}]: ${m.content.slice(0, 500)}`).join('\n');
    return `Summarize the following conversation into a compact paragraph (3-5 sentences). Preserve key decisions, questions asked, and conclusions reached.\n\n${lines}`;
  }
}

const DEFAULT_SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer. Produce a concise summary (3-5 sentences) that preserves key decisions, questions, and conclusions. Write in the same language as the conversation.`;
```

**Layer note:** The summarizer lives in `forest/agent-chat/` because it orchestrates an LLM call. It imports from `forest/agent-chat/llm-router.ts` (same layer, allowed). It does NOT import from `land/`.

## 3. Memory Pruner

**File:** `src/seed/db/repositories/memory-pruner.ts`  
**Layer:** seed (database primitive — uses existing D1 client and memory-adapter)

### Interfaces

```typescript
export interface PruneResult {
  memoryKvExpired: number;
  creatorMemoryExpired: number;
  creatorMemoryDecayed: number;
  duplicatesConsolidated: number;
  errors: string[];
}

export interface PruneOptions {
  /** Max age for memory_kv entries (ms). Default: 7 days */
  memoryKvMaxAgeMs?: number;
  /** Decay factor per day for creator_memory relevance (0.0–1.0). Default: 0.02 */
  decayFactorPerDay?: number;
  /** Minimum relevance score before deletion (0.0–1.0). Default: 0.05 */
  minRelevanceThreshold?: number;
  /** Consolidate duplicate creator_memory entries. Default: true */
  consolidateDuplicates?: boolean;
}
```

### Implementation

```typescript
export async function pruneMemories(opts: PruneOptions = {}): Promise<PruneResult> {
  const result: PruneResult = {
    memoryKvExpired: 0,
    creatorMemoryExpired: 0,
    creatorMemoryDecayed: 0,
    duplicatesConsolidated: 0,
    errors: [],
  };

  const db = getD1();
  if (!db) { result.errors.push('D1 binding not available'); return result; }

  const now = Date.now();
  const memoryKvMaxAge = opts.memoryKvMaxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
  const decayFactor = opts.decayFactorPerDay ?? 0.02;
  const minRelevance = opts.minRelevanceThreshold ?? 0.05;

  // 1. Prune expired memory_kv entries
  try {
    const deleteResult = await db
      .prepare(`DELETE FROM memory_kv WHERE updated_at < ?1`)
      .bind(now - memoryKvMaxAge)
      .run();
    result.memoryKvExpired = deleteResult.meta?.changes ?? 0;
  } catch (err) {
    result.errors.push(`memory_kv prune failed: ${getErrorMessage(err)}`);
  }

  // 2. Prune expired creator_memory entries (expires_at passed)
  try {
    const cmResult = await db
      .prepare(`DELETE FROM creator_memory WHERE expires_at IS NOT NULL AND expires_at <= ?1`)
      .bind(now)
      .run();
    result.creatorMemoryExpired = cmResult.meta?.changes ?? 0;
  } catch (err) {
    result.errors.push(`creator_memory expiry prune failed: ${getErrorMessage(err)}`);
  }

  // 3. Decay relevance scores for creator_memory
  try {
    const daysSinceEpoch = now / (24 * 60 * 60 * 1000);
    // Fetch entries with relevance > min threshold
    const rows = await db
      .prepare(`SELECT id, relevance_score, updated_at FROM creator_memory WHERE relevance_score > ?1`)
      .bind(minRelevance)
      .all<{ id: string; relevance_score: number; updated_at: number }>();

    for (const row of (rows.results ?? [])) {
      const ageDays = (now - row.updated_at) / (24 * 60 * 60 * 1000);
      const decayed = row.relevance_score * Math.pow(1 - decayFactor, ageDays);
      if (decayed <= minRelevance) {
        await db.prepare(`DELETE FROM creator_memory WHERE id = ?1`).bind(row.id).run();
        result.creatorMemoryDecayed++;
      } else {
        await db
          .prepare(`UPDATE creator_memory SET relevance_score = ?1, updated_at = ?2 WHERE id = ?3`)
          .bind(Math.round(decayed * 1000) / 1000, now, row.id)
          .run();
      }
    }
  } catch (err) {
    result.errors.push(`creator_memory decay failed: ${getErrorMessage(err)}`);
  }

  // 4. Consolidate duplicate creator_memory entries (same user_id + memory_type + category)
  if (opts.consolidateDuplicates !== false) {
    try {
      const dupResult = await consolidateDuplicateMemories(db);
      result.duplicatesConsolidated = dupResult;
    } catch (err) {
      result.errors.push(`duplicate consolidation failed: ${getErrorMessage(err)}`);
    }
  }

  return result;
}

/** Consolidate duplicate creator_memory entries, keeping the highest-relevance one */
async function consolidateDuplicateMemories(db: D1Database): Promise<number> {
  // Find groups with duplicates (same user_id + memory_type + category)
  const dupGroups = await db
    .prepare(`
      SELECT user_id, memory_type, category, COUNT(*) as cnt
      FROM creator_memory
      GROUP BY user_id, memory_type, category
      HAVING COUNT(*) > 1
    `)
    .all<{ user_id: string; memory_type: string; category: string; cnt: number }>();

  let consolidated = 0;
  for (const group of (dupGroups.results ?? [])) {
    // Get all entries in this group, sorted by relevance DESC
    const entries = await db
      .prepare(`
        SELECT id, relevance_score, content_json, created_at
        FROM creator_memory
        WHERE user_id = ?1 AND memory_type = ?2 AND category = ?3
        ORDER BY relevance_score DESC, created_at DESC
      `)
      .bind(group.user_id, group.memory_type, group.category)
      .all<{ id: string; relevance_score: number; content_json: string; created_at: number }>();

    const entriesList = entries.results ?? [];
    if (entriesList.length <= 1) continue;

    // Keep the highest-relevance entry, merge content from others into it
    const keeper = entriesList[0];
    const mergedContent = {
      ...JSON.parse(keeper.content_json),
      _mergedFrom: entriesList.slice(1).map(e => e.id),
      consolidatedAt: Date.now(),
    };

    await db
      .prepare(`UPDATE creator_memory SET content_json = ?1, updated_at = ?2 WHERE id = ?3`)
      .bind(JSON.stringify(mergedContent), Date.now(), keeper.id)
      .run();

    // Delete the rest
    const idsToDelete = entriesList.slice(1).map(e => e.id);
    const placeholders = idsToDelete.map((_, i) => `?${i + 1}`).join(',');
    await db.prepare(`DELETE FROM creator_memory WHERE id IN (${placeholders})`).bind(...idsToDelete).run();

    consolidated += idsToDelete.length;
  }
  return consolidated;
}
```

## 4. Token Counter

**File:** `src/seed/ai/token-counter.ts`  
**Layer:** seed (foundational primitive — used by all layers)

### Rationale

The existing `cost-estimator.ts` has `estimateTokenCount()` and `countMessageTokens()`, but they are:
1. Heuristic-based (character count approximation) — not accurate enough for context window enforcement
2. Not provider-aware — Anthropic and OpenAI use different tokenisation
3. Not exposed as a standalone service

This module provides accurate token counting per provider using the official tokenisation approach where available, falling back to improved heuristics.

### Interfaces

```typescript
export type TokenizerProvider = 'anthropic' | 'openai' | 'openrouter';

export interface TokenCountResult {
  total: number;
  byMessage: Array<{ role: string; tokens: number }>;
  provider: TokenizerProvider;
  model: string;
}

export interface TokenCounterConfig {
  /** Overhead per message (role tokens, formatting). Default: 4 */
  messageOverhead: number;
  /** Overhead for the full prompt (system + formatting). Default: 2 */
  promptOverhead: number;
}
```

### Implementation

```typescript
export class TokenCounter {
  constructor(private config: TokenCounterConfig = {}) {}

  /**
   * Count tokens for a set of messages using the appropriate provider tokenizer.
   * Uses tiktoken-compatible heuristics for OpenAI, cl100k_base for Anthropic models.
   */
  countMessages(messages: ChatMessage[], modelId: string): TokenCountResult {
    const provider = this.inferProvider(modelId);
    const overhead = this.config.messageOverhead ?? 4;
    const promptOverhead = this.config.promptOverhead ?? 2;

    let total = promptOverhead;
    const byMessage: Array<{ role: string; tokens: number }> = [];

    for (const msg of messages) {
      const contentTokens = this.countText(msg.content, provider, modelId);
      const roleTokens = this.countText(msg.role, provider, modelId);
      const msgTotal = contentTokens + roleTokens + overhead;
      total += msgTotal;
      byMessage.push({ role: msg.role, tokens: msgTotal });
    }

    return { total, byMessage, provider, model: modelId };
  }

  /**
   * Count tokens for a single text string.
   * Uses improved heuristics that account for CJK/Vietnamese characters.
   */
  countText(text: string, provider: TokenizerProvider, modelId?: string): number {
    // For Anthropic claude models, use cl100k_base approximation
    if (provider === 'anthropic') {
      return this.countCl100kBase(text);
    }
    // For OpenAI/OpenRouter, use similar heuristic
    return this.countCl100kBase(text);
  }

  /**
   * cl100k_base tokenizer approximation.
   * More accurate than simple char/4 for mixed CJK/English text.
   */
  private countCl100kBase(text: string): number {
    // CJK + Vietnamese: ~1 token per character
    const cjkVn = (text.match(/[一-鿿぀-ゟ゠-ヿ가-힯-ÿĀ-ſ]/g) ?? []).length;
    // ASCII whitespace-separated words: ~1.33 tokens per word
    const asciiText = text.replace(/[一-鿿぀-ゟ゠-ヿ가-힯-ÿĀ-ſ]/g, ' ');
    const words = asciiText.split(/\s+/).filter(w => w.length > 0);
    const asciiTokens = words.length * 1.33;
    // Numbers and punctuation: add ~0.5 tokens per 10 chars
    const punctTokens = (text.length - cjkVn - asciiText.replace(/\s/g, '').length) / 20;

    return Math.ceil(cjkVn + asciiTokens + Math.max(0, punctTokens));
  }

  /**
   * Get the context window size for a model.
   */
  getContextWindow(modelId: string): number {
    const lower = modelId.toLowerCase();
    // Anthropic models
    if (lower.includes('claude-opus-4')) return 200_000;
    if (lower.includes('claude-sonnet-4')) return 200_000;
    if (lower.includes('claude-3-5-sonnet')) return 200_000;
    if (lower.includes('claude-3-5-haiku')) return 200_000;
    // OpenAI models via OpenRouter
    if (lower.includes('gpt-4o')) return 128_000;
    if (lower.includes('gpt-4-turbo')) return 128_000;
    if (lower.includes('o3') || lower.includes('o4-mini')) return 200_000;
    // DeepSeek
    if (lower.includes('deepseek')) return 64_000;
    // Default
    return 8_192;
  }

  private inferProvider(modelId: string): TokenizerProvider {
    const lower = modelId.toLowerCase();
    if (lower.startsWith('claude') || lower.startsWith('anthropic/')) return 'anthropic';
    return 'openai'; // OpenRouter uses OpenAI-compatible tokenisation
  }
}
```

## 5. Integration Points — agent-chat Route

**File modified:** `src/app/api/v1/agent-chat/route.ts`  
**Constraint:** Must NOT break existing flow. Context management is opt-in via config.

### Integration Strategy

Add a context management middleware step between message parsing and LLM call. The step is gated by a feature flag (`ENABLE_CONTEXT_MANAGEMENT`) so the existing route works identically when disabled.

```typescript
// In route.ts, after parsing messages (line ~73) and before building system prompt (line ~106):

// ── Phase 7: Context Window Management (opt-in) ─────────────────────────────
const ENABLE_CONTEXT_MANAGEMENT = process.env.ENABLE_CONTEXT_MANAGEMENT === 'true';

if (ENABLE_CONTEXT_MANAGEMENT) {
  const contextManager = createContextManager(); // factory, creates with defaults
  const modelId = llmRoute.model;
  
  // Check if context fits
  const fits = await contextManager.fitsInContext(fullMessages, modelId);
  if (!fits) {
    const { messages: trimmedMessages, result } = await contextManager.trim(
      fullMessages, modelId, user.id,
    );
    logger.info('[agent-chat] Context trimmed', {
      userId: user.id,
      strategy: 'summarization',
      messagesKept: result.messagesKept,
      messagesRemoved: result.messagesRemoved,
      tokensBefore: result.tokensBefore,
      tokensAfter: result.tokensAfter,
      summary: result.summary ? '(produced)' : undefined,
    });
    fullMessages = trimmedMessages;
  }
}
// ── End Phase 7 context management ──────────────────────────────────────────
```

### Factory function (in `src/forest/agent-chat/context-manager.ts`)

```typescript
export function createContextManager(): ContextManager {
  const tokenCounter = new TokenCounter();
  const summarizer = new ConversationSummarizer(
    { maxSummaryTokens: 512, temperature: 0.3 },
    resolveLlmRoute,
  );
  return new ContextManager(
    {
      maxContextTokens: 200_000,   // Claude Sonnet default; overridden per model
      reservedOutputTokens: 4096,
      strategy: 'summarization',
      minMessagesKept: 4,
      enableSummarization: true,
      summarizationThreshold: 0.75,
    },
    tokenCounter,
    summarizer,
    memory,  // from tree/agent-fleet/memory-adapter
  );
}
```

### Conversation summary storage

After a chat session completes, store the conversation summary back to `memory_kv`:

```typescript
// In route.ts, after stream completes (in the finally block or stream end):
if (ENABLE_CONTEXT_MANAGEMENT && trimResult?.summary) {
  await memory.store('session', `chat-summary:${sessionId}`, {
    summary: trimResult.summary,
    messageCount: originalMessageCount,
    userId: user.id,
    createdAt: Date.now(),
  }, user.id);
}
```

## 6. Memory Pruner Cron Integration

**Existing cron:** `src/app/api/cron/memory-consolidation/route.ts`  
**Extension:** Add prune step to existing cron route (no new endpoint needed).

```typescript
// In the existing cron route, after consolidation:
const pruneResult = await pruneMemories({
  memoryKvMaxAgeMs: 7 * 24 * 60 * 60 * 1000,  // 7 days
  decayFactorPerDay: 0.02,
  minRelevanceThreshold: 0.05,
  consolidateDuplicates: true,
});
logger.info('[cron/memory-consolidation] Prune complete', pruneResult);
```

## 7. File Inventory

### New Files

| File | Layer | Purpose |
|------|-------|---------|
| `src/seed/ai/token-counter.ts` | seed | Accurate token counting per provider |
| `src/forest/agent-chat/context-manager.ts` | forest | Context window management + trimming strategies |
| `src/forest/agent-chat/conversation-summarizer.ts` | forest | LLM-based conversation summarization |
| `src/seed/db/repositories/memory-pruner.ts` | seed | Memory cleanup: expiry, decay, dedup |
| `src/forest/agent-chat/__tests__/context-manager.test.ts` | forest | Context manager tests |
| `src/forest/agent-chat/__tests__/conversation-summarizer.test.ts` | forest | Summarizer tests |
| `src/seed/ai/__tests__/token-counter.test.ts` | seed | Token counter tests |
| `src/seed/db/repositories/__tests__/memory-pruner.test.ts` | seed | Memory pruner tests |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/v1/agent-chat/route.ts` | Add context management middleware (opt-in via env flag) |
| `src/app/api/cron/memory-consolidation/route.ts` | Add prune step after consolidation |
| `src/seed/ai/index.ts` | Re-export `TokenCounter` |

## 8. Layer Compliance Check

| Module | Layer | Imports | Compliant? |
|--------|-------|---------|------------|
| `token-counter.ts` | seed | `logger-utility` (seed) | Yes |
| `context-manager.ts` | forest | `token-counter` (seed), `memory-adapter` (tree), `llm-router` (forest), `summarizer` (forest) | Yes |
| `conversation-summarizer.ts` | forest | `llm-router` (forest) | Yes |
| `memory-pruner.ts` | seed | `db/client` (seed), `logger-utility` (seed), `creator-memory-repo` (seed) | Yes |
| `agent-chat/route.ts` modification | land | `context-manager` (forest — allowed: land imports forest) | Yes |

## 9. Backward Compatibility

- `ENABLE_CONTEXT_MANAGEMENT` env flag defaults to `false`
- When disabled, route.ts follows the exact same code path as before
- All new modules are additive — no existing interfaces change
- `ChatMessage`, `ChatContext`, `SseEvent` types unchanged
- `LlmRoute` type unchanged
- `MemoryAdapter` interface unchanged (memory-pruner uses it, doesn't extend it)

## 10. Cloudflare Workers Compatibility

- No Node.js-specific APIs (no `fs`, no `child_process`, no `Buffer` beyond what's already used)
- D1 queries use existing `getD1()` pattern (sync binding, no `await` on client creation)
- LLM calls use `fetch` (available in Workers runtime)
- No `process.cwd()` or filesystem access
- All async operations use standard Promise patterns

## 11. Unresolved Questions

1. **Context window size per model:** The `TokenCounter.getContextWindow()` has hardcoded values. Should these come from a config table or env vars instead? Decision needed before implementation.
2. **Summary storage TTL:** How long should conversation summaries persist in `memory_kv` before pruning? Suggest 30 days, but needs confirmation.
3. **Importance scoring for importance-based retention:** Currently uses heuristics (role + length + recency). Should this integrate with Phase 6 Qdrant vector scores when available? If so, the `ContextManager` constructor could accept an optional `vectorScorer` callback.
4. **Summarization cost:** Each summarization triggers an extra LLM call. Should there be a credit deduction for this, or is it covered by the existing 1 MCU per session?
