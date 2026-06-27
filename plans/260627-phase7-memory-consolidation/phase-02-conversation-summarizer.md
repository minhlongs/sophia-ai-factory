# Phase 02: Conversation Summarizer

**Layer:** tree (domain logic)
**Dependencies:** Phase 01 (ContextWindowManager)
**Files to create:**
- `src/tree/context/conversation-summarizer.ts`
- `src/tree/context/index.ts`
- `src/tree/context/conversation-summarizer.test.ts`

---

## Requirements

Compress old messages into a summary when context is trimmed. The summary replaces the oldest messages in the conversation, preserving recent context. Uses the configured LLM provider (DeepSeek or Anthropic via existing llm-router).

## Architecture

```
ConversationSummarizer
├── llmRouter: LlmRoute resolver
├── summarize(messages: ChatMessage[], existingSummary?: string): Promise<string>
└── buildSummaryPrompt(messages, existingSummary): string
```

## Implementation

```typescript
// src/tree/context/conversation-summarizer.ts

import type { ChatMessage, LlmRoute } from '@/land/agent-chat/types';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('tree/context');

const SUMMARY_SYSTEM_PROMPT_EN = `You are a conversation summarizer. Compress the following chat messages into a concise summary (max 300 words). Preserve key facts, user preferences, decisions made, and action items. Write in the same language as the messages (Vietnamese or English).`;

const SUMMARY_SYSTEM_PROMPT_VI = `Bạn là bộ tóm tắt hội thoại. Nén các tin nhắn chat sau thành bản tóm tắt ngắn gọn (tối đa 300 từ). Giữ lại các sự kiện chính, sở thích người dùng, quyết định đã đưa ra và các hành động cần thực hiện. Viết bằng ngôn ngữ của tin nhắn (Tiếng Việt hoặc Tiếng Anh).`;

export interface SummarizerOptions {
  maxSummaryWords?: number;
  locale?: 'en' | 'vi';
}

export class ConversationSummarizer {
  private maxWords: number;
  private locale: 'en' | 'vi';

  constructor(options: SummarizerOptions = {}) {
    this.maxWords = options.maxSummaryWords ?? 300;
    this.locale = options.locale ?? 'en';
  }

  /**
   * Summarize a list of messages into a single string.
   * Uses the LLM provider resolved from llmRouter.
   */
  async summarize(
    messages: ChatMessage[],
    existingSummary: string | null,
    resolveRoute: () => Promise<LlmRoute>,
  ): Promise<string> {
    if (messages.length === 0) {
      return existingSummary ?? '';
    }

    const route = await resolveRoute();
    const userText = this.buildUserPrompt(messages, existingSummary);
    const systemPrompt = this.locale === 'vi' ? SUMMARY_SYSTEM_PROMPT_VI : SUMMARY_SYSTEM_PROMPT_EN;

    try {
      const summary = await this.callLlm(route, systemPrompt, userText);
      return this.truncateToWordLimit(summary);
    } catch (err) {
      logger.error('conversation-summarizer.llm-failed', err as Error, {
        provider: route.provider,
        messageCount: messages.length,
      });
      // Fallback: concatenate first 200 chars of each message
      return this.fallbackSummary(messages, existingSummary);
    }
  }

  private buildUserPrompt(messages: ChatMessage[], existingSummary: string | null): string {
    const parts: string[] = [];
    if (existingSummary) {
      parts.push(`Previous summary:\n${existingSummary}\n`);
    }
    parts.push('Messages to summarize:');
    for (const msg of messages) {
      parts.push(`[${msg.role}]: ${msg.content}`);
    }
    return parts.join('\n\n');
  }

  private async callLlm(
    route: LlmRoute,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: route.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 512,
      temperature: 0.3,
    };

    const response = await fetch(`${route.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${route.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM summarize failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  private truncateToWordLimit(text: string): string {
    const words = text.split(/\s+/);
    if (words.length <= this.maxWords) return text;
    return words.slice(0, this.maxWords).join(' ') + '...';
  }

  private fallbackSummary(messages: ChatMessage[], existingSummary: string | null): string {
    const prefix = existingSummary ? `${existingSummary}\n\n` : '';
    const compressed = messages
      .slice(0, 5)
      .map(m => `[${m.role}]: ${m.content.slice(0, 200)}`)
      .join('\n');
    return `${prefix}[Fallback summary]:\n${compressed}`;
  }
}
```

## Tests

```typescript
// src/tree/context/conversation-summarizer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { ConversationSummarizer } from './conversation-summarizer';
import type { ChatMessage, LlmRoute } from '@/land/agent-chat/types';

describe('ConversationSummarizer', () => {
  const summarizer = new ConversationSummarizer({ locale: 'en' });

  const mockRoute: LlmRoute = {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'test-key',
    model: 'deepseek-reasoner',
  };

  it('calls LLM with correct payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'User asked about SOPs.' } }],
      }),
    });

    global.fetch = fetchMock;

    const messages: ChatMessage[] = [
      { role: 'user', content: 'How do I run an SOP?' },
      { role: 'assistant', content: 'Use Cmd+K to run SOP.' },
    ];

    const summary = await summarizer.summarize(messages, null, async () => mockRoute);

    expect(fetchMock).toHaveBeenCalledOnce();
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.deepseek.com/v1/chat/completions');
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe('deepseek-reasoner');
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(512);
    expect(summary).toBe('User asked about SOPs.');
  });

  it('includes existing summary in prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'combined' } }] }),
    });
    global.fetch = fetchMock;

    await summarizer.summarize(
      [{ role: 'user', content: 'new msg' }],
      'previous summary',
      async () => mockRoute,
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userContent = body.messages.find((m: Record<string, unknown>) => m.role === 'user').content;
    expect(userContent).toContain('Previous summary:');
    expect(userContent).toContain('previous summary');
  });

  it('returns empty string for empty messages', async () => {
    const summary = await summarizer.summarize([], null, async () => mockRoute);
    expect(summary).toBe('');
  });

  it('falls back to concatenation on LLM failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    global.fetch = fetchMock;

    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];

    const summary = await summarizer.summarize(messages, null, async () => mockRoute);
    expect(summary).toContain('hello');
    expect(summary).toContain('hi there');
    expect(summary).toContain('[Fallback summary]');
  });

  it('truncates long summaries to word limit', async () => {
    const longText = 'word '.repeat(500) + 'end';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: longText } }] }),
    });
    global.fetch = fetchMock;

    const summary = await summarizer.summarize(
      [{ role: 'user', content: 'test' }],
      null,
      async () => mockRoute,
    );

    const wordCount = summary.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(300);
    expect(summary).toContain('...');
  });
});
```

## Risks

- LLM call adds latency (~200-500ms) to trim operation. Acceptable since trim is async.
- Fallback summary is lossy but prevents total failure.
- Must not import from `@/land` directly — `ChatMessage` and `LlmRoute` are types only (no runtime dependency).
