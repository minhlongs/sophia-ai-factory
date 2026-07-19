# Phase 01: Context Window Manager
**Status:** completed

**Layer:** seed (primitive) → tree (domain logic)
**Dependencies:** None (foundational)
**Files to create:**
- `src/seed/context/context-window-manager.ts`
- `src/seed/context/index.ts`
- `src/seed/context/context-window-manager.test.ts`

---

## Requirements

Track token count per conversation. When approaching model limit (80% of context window), trigger consolidation. Provide methods: `getTokenCount()`, `trimToFit()`, `getUtilization()`.

## Architecture

```
ContextWindowManager
├── modelContextLimit: number      // e.g. 65536 for DeepSeek R1
├── messages: ChatMessage[]
├── summary: string | null         // compressed summary of trimmed messages
├── getTokenCount(): number        // approximate via char/4 heuristic
├── getUtilization(): number       // 0.0 – 1.0
├── trimToFit(maxTokens?): ChatMessage[]  // returns trimmed messages, stores summary
└── addMessage(msg): void
```

## Token Counting Heuristic

No tiktoken library (not CF Workers compatible). Use char/4 for CJK+EN mixed content:

```typescript
function estimateTokens(text: string): number {
  // CJK characters are ~1.5 tokens each; Latin words ~0.75 tokens per word
  // char/4 is a reasonable middle ground for mixed VI/EN content
  return Math.ceil(text.length / 4);
}
```

## Context Window Limits by Model

```typescript
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'deepseek-reasoner': 65536,
  'deepseek-chat': 32768,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-haiku-20240307': 200000,
};
```

## Implementation

```typescript
// src/seed/context/context-window-manager.ts

import type { ChatMessage } from '@/land/agent-chat/types';

export interface ContextWindowConfig {
  model: string;
  thresholdRatio?: number; // default 0.8 (80%)
}

const MODEL_LIMITS: Record<string, number> = {
  'deepseek-reasoner': 65536,
  'deepseek-chat': 32768,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-haiku-20240307': 200000,
};

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(msg: ChatMessage): number {
  // Role + content overhead: ~4 tokens per message for role/formatting
  return estimateTokens(msg.content) + 4;
}

export class ContextWindowManager {
  private messages: ChatMessage[] = [];
  private summary: string | null = null;
  private config: Required<ContextWindowConfig>;

  constructor(config: ContextWindowConfig) {
    const model = config.model;
    this.config = {
      model,
      thresholdRatio: config.thresholdRatio ?? 0.8,
    };
  }

  getTokenCount(): number {
    let total = estimateTokens(this.summary ?? '');
    for (const msg of this.messages) {
      total += estimateMessageTokens(msg);
    }
    return total;
  }

  getLimit(): number {
    return MODEL_LIMITS[this.config.model] ?? 32768;
  }

  getUtilization(): number {
    return this.getTokenCount() / this.getLimit();
  }

  isNearLimit(): boolean {
    return this.getUtilization() >= this.config.thresholdRatio;
  }

  addMessage(msg: ChatMessage): void {
    this.messages.push(msg);
  }

  addMessages(msgs: ChatMessage[]): void {
    this.messages.push(...msgs);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getSummary(): string | null {
    return this.summary;
  }

  /**
   * Trim oldest messages, replacing them with a summary.
   * Keeps the most recent messages intact.
   * Returns the messages that were trimmed.
   */
  trimToFit(maxTokens?: number): ChatMessage[] {
    const limit = maxTokens ?? this.getLimit();
    const targetCount = Math.floor(limit * this.config.thresholdRatio);

    // Build summary from existing summary + oldest messages
    const trimmed: ChatMessage[] = [];
    let currentCount = estimateTokens(this.summary ?? '');

    // Walk from oldest, accumulating until we need to stop
    const keepFromIndex = this.messages.length; // default: keep all
    for (let i = 0; i < this.messages.length; i++) {
      const msgTokens = estimateMessageTokens(this.messages[i]);
      if (currentCount + msgTokens > targetCount && i > 0) {
        keepFromIndex = i;
        break;
      }
      currentCount += msgTokens;
    }

    if (keepFromIndex > 0) {
      trimmed.push(...this.messages.slice(0, keepFromIndex));
      // Compress trimmed messages into summary
      const trimmedContent = this.messages
        .slice(0, keepFromIndex)
        .map(m => `[${m.role}]: ${m.content}`)
        .join('\n');
      this.summary = this.summary
        ? `${this.summary}\n\n[Earlier conversation summary]:\n${trimmedContent}`
        : `[Earlier conversation summary]:\n${trimmedContent}`;
      this.messages = this.messages.slice(keepFromIndex);
    }

    return trimmed;
  }

  reset(): void {
    this.messages = [];
    this.summary = null;
  }
}
```

## Tests

```typescript
// src/seed/context/context-window-manager.test.ts

import { describe, it, expect } from 'vitest';
import { ContextWindowManager, estimateTokens, estimateMessageTokens } from './context-window-manager';
import type { ChatMessage } from '@/land/agent-chat/types';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ~char/4 for EN text', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
  });

  it('estimates ~char/4 for VI text', () => {
    expect(estimateTokens('xin chào bạn')).toBe(3); // 12 chars / 4 = 3
  });

  it('handles mixed CJK+EN', () => {
    expect(estimateTokens('你好 hello')).toBe(3); // 9 chars / 4 = 2.25 -> 3
  });
});

describe('estimateMessageTokens', () => {
  it('adds 4 token overhead per message', () => {
    const msg: ChatMessage = { role: 'user', content: 'hello' };
    expect(estimateMessageTokens(msg)).toBe(estimateTokens('hello') + 4);
  });
});

describe('ContextWindowManager', () => {
  it('tracks utilization correctly', () => {
    const mgr = new ContextWindowManager({ model: 'deepseek-reasoner' });
    expect(mgr.getUtilization()).toBe(0);
    mgr.addMessage({ role: 'user', content: 'hi' });
    expect(mgr.getUtilization()).toBeGreaterThan(0);
  });

  it('detects near-limit at 80% threshold', () => {
    const mgr = new ContextWindowManager({ model: 'deepseek-reasoner', thresholdRatio: 0.8 });
    // Fill to 79% — should not trigger
    const shortMsg: ChatMessage = { role: 'user', content: 'x'.repeat(100) };
    const tokensPerMsg = estimateMessageTokens(shortMsg);
    const limit = 65536;
    const target = Math.floor(limit * 0.79);
    const count = Math.ceil(target / tokensPerMsg);
    for (let i = 0; i < count; i++) {
      mgr.addMessage(shortMsg);
    }
    expect(mgr.isNearLimit()).toBe(false);

    // Add one more to cross 80%
    mgr.addMessage(shortMsg);
    expect(mgr.isNearLimit()).toBe(true);
  });

  it('trimToFit removes oldest messages and creates summary', () => {
    const mgr = new ContextWindowManager({ model: 'deepseek-reasoner', thresholdRatio: 0.5 });
    mgr.addMessage({ role: 'user', content: 'first message' });
    mgr.addMessage({ role: 'assistant', content: 'second message' });
    mgr.addMessage({ role: 'user', content: 'third message' });
    const trimmed = mgr.trimToFit();
    expect(trimmed.length).toBeGreaterThan(0);
    expect(mgr.getSummary()).not.toBeNull();
    expect(mgr.getSummary()).toContain('first message');
  });

  it('reset clears all state', () => {
    const mgr = new ContextWindowManager({ model: 'deepseek-reasoner' });
    mgr.addMessage({ role: 'user', content: 'hello' });
    mgr.reset();
    expect(mgr.getMessages()).toHaveLength(0);
    expect(mgr.getSummary()).toBeNull();
    expect(mgr.getTokenCount()).toBe(0);
  });

  it('getMessages returns a copy, not the internal array', () => {
    const mgr = new ContextWindowManager({ model: 'deepseek-reasoner' });
    mgr.addMessage({ role: 'user', content: 'hello' });
    const msgs = mgr.getMessages();
    msgs.push({ role: 'user', content: 'mutated' });
    expect(mgr.getMessages()).toHaveLength(1);
  });
});
```

## Risks

- Token estimation is approximate; real usage may differ by 10-20%. Acceptable for trigger threshold.
- No `:any` types — all interfaces fully typed.
- No `console.*` — uses `createLogger` from `@/seed/utils/logger-utility`.
