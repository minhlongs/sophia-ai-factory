# Phase 04: Chat Integration

**Layer:** land (business workflow)
**Dependencies:** Phase 01 (ContextWindowManager), Phase 02 (ConversationSummarizer), Phase 03 (MemoryConsolidator)
**Files to create:**
- `src/land/agent-chat/context-manager.ts`
- `src/land/agent-chat/context-manager.test.ts`

**Files to modify:**
- `src/land/agent-chat/index.ts` (add context-managed export)
- `src/land/agent-chat/system-prompt.ts` (add memory injection)

---

## Requirements

Wire context management into the agent-chat flow. Before sending to LLM:
1. Check token count
2. Summarize if near limit
3. Inject relevant creator memories into system prompt
4. Send to LLM

Backward compatible — existing agent-chat flow works without memory features.

## Integration Flow

```
User sends message
  → addMessage(msg)
  → getTokenCount() >= threshold?
    YES → summarize(old messages) → trimToFit()
  → query creator_memory for relevant entries (tenant-scoped)
  → buildSystemPrompt(context) + inject memories
  → send to LLM
  → after response: store key facts as creator_memory (Phase 05)
```

## Implementation

```typescript
// src/land/agent-chat/context-manager.ts

import type { ChatMessage, ChatContext, LlmRoute } from './types';
import { ContextWindowManager, estimateTokens } from '@/seed/context/context-window-manager';
import { ConversationSummarizer } from '@/tree/context/conversation-summarizer';
import { memory } from '@/land/openclaw/memory-adapter';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('land/agent-chat');

export interface ContextManagedChat {
  messages: ChatMessage[];
  summary: string | null;
  utilization: number;
  wasTrimmed: boolean;
}

export interface ContextManagerConfig {
  model: string;
  thresholdRatio?: number;
  maxMemoriesToInject?: number;
  memoryRelevanceThreshold?: number;
}

export class AgentChatContextManager {
  private windowManager: ContextWindowManager;
  private summarizer: ConversationSummarizer;
  private config: Required<ContextManagerConfig>;
  private tenantId: string;
  private resolveRoute: () => Promise<LlmRoute>;

  constructor(
    tenantId: string,
    resolveRoute: () => Promise<LlmRoute>,
    config: ContextManagerConfig = {},
  ) {
    this.tenantId = tenantId;
    this.resolveRoute = resolveRoute;
    this.config = {
      model: config.model,
      thresholdRatio: config.thresholdRatio ?? 0.8,
      maxMemoriesToInject: config.maxMemoriesToInject ?? 5,
      memoryRelevanceThreshold: config.memoryRelevanceThreshold ?? 0.3,
    };
    this.windowManager = new ContextWindowManager({ model: this.config.model });
    this.summarizer = new ConversationSummarizer();
  }

  /**
   * Add a new message to the conversation.
   */
  addMessage(msg: ChatMessage): void {
    this.windowManager.addMessage(msg);
  }

  /**
   * Add multiple messages (e.g., loading history from storage).
   */
  addMessages(msgs: ChatMessage[]): void {
    this.windowManager.addMessages(msgs);
  }

  /**
   * Get current messages for LLM call.
   * Triggers summarization if near context limit.
   */
  async getMessagesForLlm(): Promise<ContextManagedChat> {
    let wasTrimmed = false;

    if (this.windowManager.isNearLimit()) {
      logger.info('agent-chat.context.near-limit', undefined, {
        tenantId: this.tenantId,
        utilization: this.windowManager.getUtilization(),
        tokenCount: this.windowManager.getTokenCount(),
        limit: this.windowManager.getLimit(),
      });

      const toTrim = this.windowManager.getMessages().slice(0, -1); // keep last message
      if (toTrim.length > 0) {
        const summary = await this.summarizer.summarize(
          toTrim,
          this.windowManager.getSummary(),
          this.resolveRoute,
        );
        // Update the window manager's summary via trimToFit
        this.windowManager.trimToFit();
        wasTrimmed = true;
      }
    }

    return {
      messages: this.windowManager.getMessages(),
      summary: this.windowManager.getSummary(),
      utilization: this.windowManager.getUtilization(),
      wasTrimmed,
    };
  }

  /**
   * Build system prompt with injected creator memories.
   */
  async buildSystemPrompt(context: ChatContext): Promise<string> {
    const { buildSystemPrompt: basePrompt } = await import('./system-prompt');
    let prompt = basePrompt(context);

    // Inject relevant creator memories
    const memories = await this.fetchRelevantMemories();
    if (memories.length > 0) {
      const memoryLines: string[] = [];
      const isVi = context.locale === 'vi';

      if (isVi) {
        memoryLines.push('\n\n[Thông tin đã biết về người dùng]:');
      } else {
        memoryLines.push('\n\n[Known user context]:');
      }

      for (const mem of memories) {
        try {
          const value = JSON.parse(mem.value_json);
          const text = typeof value === 'string' ? value : JSON.stringify(value);
          memoryLines.push(`- ${text}`);
        } catch {
          memoryLines.push(`- ${mem.value_json}`);
        }
      }

      prompt += memoryLines.join('\n');
    }

    // Append summary if present
    const summary = this.windowManager.getSummary();
    if (summary) {
      const isVi = context.locale === 'vi';
      const prefix = isVi ? '\n\n[Tóm tắt hội thoại trước]:' : '\n\n[Previous conversation summary]:';
      prompt += `${prefix}\n${summary}`;
    }

    return prompt;
  }

  /**
   * Fetch creator memories relevant to the current conversation.
   * Simple keyword matching against memory keys and values.
   */
  private async fetchRelevantMemories(): Promise<
    Array<{ key_name: string; value_json: string; relevance_score: number }>
  > {
    try {
      const result = await memory.query(
        'creator_memory',
        `recent:${this.tenantId}`,
        this.tenantId,
      );

      if (!result) return [];

      // The memory adapter stores JSON; expect an array of memory entries
      const memories = Array.isArray(result) ? result : [];
      return memories
        .filter((m: { relevance_score: number }) => m.relevance_score >= this.config.memoryRelevanceThreshold)
        .sort((a: { relevance_score: number }, b: { relevance_score: number }) => b.relevance_score - a.relevance_score)
        .slice(0, this.config.maxMemoriesToInject);
    } catch {
      logger.warn('agent-chat.context.memory-fetch-failed', undefined, {
        tenantId: this.tenantId,
      });
      return [];
    }
  }

  getUtilization(): number {
    return this.windowManager.getUtilization();
  }

  getTokenCount(): number {
    return this.windowManager.getTokenCount();
  }

  reset(): void {
    this.windowManager.reset();
  }
}
```

## Backward Compatibility

The existing `src/land/agent-chat/index.ts` barrel export remains unchanged. New context-managed flow is opt-in:

```typescript
// Existing flow (unchanged):
import { resolveLlmRoute } from '@/land/agent-chat';
// ... direct use without context management

// New flow (opt-in):
import { AgentChatContextManager } from '@/land/agent-chat/context-manager';
const ctx = new AgentChatContextManager(tenantId, resolveLlmRoute);
ctx.addMessage({ role: 'user', content: 'hello' });
const { messages, summary } = await ctx.getMessagesForLlm();
const systemPrompt = await ctx.buildSystemPrompt({ locale: 'vi' });
```

## System Prompt Update

```typescript
// src/land/agent-chat/system-prompt.ts (add memory note)

const MEMORY_NOTE_EN = '\nNote: You have access to user context from previous conversations. Use it naturally without mentioning that you "remember" anything.';
const MEMORY_NOTE_VI = '\nLưu ý: Bạn có thông tin ngữ cảnh từ các cuộc trò chuyện trước. Sử dụng tự nhiên, không cần đề cập rằng bạn "nhớ" điều gì.';

export function buildSystemPrompt(context: ChatContext, hasMemories: boolean = false): string {
  // ... existing logic ...
  if (hasMemories) {
    lines.push(context.locale === 'vi' ? MEMORY_NOTE_VI : MEMORY_NOTE_EN);
  }
  return lines.join('\n');
}
```

## Tests

```typescript
// src/land/agent-chat/context-manager.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentChatContextManager } from './context-manager';
import type { ChatMessage, ChatContext, LlmRoute } from './types';

function makeMsg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { role, content };
}

describe('AgentChatContextManager', () => {
  let manager: AgentChatContextManager;
  let mockResolveRoute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockResolveRoute = vi.fn().mockResolvedValue({
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-reasoner',
    } as LlmRoute);
    manager = new AgentChatContextManager('tenant-1', mockResolveRoute, {
      model: 'deepseek-reasoner',
    });
  });

  it('tracks messages', () => {
    manager.addMessage(makeMsg('user', 'hello'));
    manager.addMessage(makeMsg('assistant', 'hi'));
    expect(manager.getTokenCount()).toBeGreaterThan(0);
  });

  it('getMessagesForLlm returns messages without trim when under limit', async () => {
    manager.addMessage(makeMsg('user', 'hi'));
    const result = await manager.getMessagesForLlm();
    expect(result.wasTrimmed).toBe(false);
    expect(result.messages).toHaveLength(1);
  });

  it('addMessages batch adds correctly', () => {
    manager.addMessages([
      makeMsg('user', 'msg1'),
      makeMsg('user', 'msg2'),
    ]);
    expect(manager.getMessages()).toHaveLength(2);
  });

  it('reset clears state', () => {
    manager.addMessage(makeMsg('user', 'hello'));
    manager.reset();
    expect(manager.getTokenCount()).toBe(0);
    expect(manager.getMessages()).toHaveLength(0);
  });

  it('getUtilization returns 0 for empty conversation', () => {
    expect(manager.getUtilization()).toBe(0);
  });

  it('buildSystemPrompt includes memory note when hasMemories is true', async () => {
    const prompt = await manager.buildSystemPrompt({ locale: 'en' }, true);
    expect(prompt).toContain('user context');
  });

  it('buildSystemPrompt omits memory note when hasMemories is false', async () => {
    const prompt = await manager.buildSystemPrompt({ locale: 'en' }, false);
    expect(prompt).not.toContain('user context');
  });
});
```

## Risks

- `buildSystemPrompt` uses dynamic import of `./system-prompt` to avoid circular deps — verify no cycle.
- Memory fetch from D1 is async but lightweight (indexed query).
- Backward compatibility: no changes to existing exports.
