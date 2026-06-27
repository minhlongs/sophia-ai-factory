/**
 * POST /api/v1/agent-chat
 *
 * SSE-streaming chat endpoint routing through DeepSeek R1 cloud or
 * Anthropic Claude fallback, with context management and memory consolidation.
 *
 * Auth: session via getCurrentUser()
 * Body: { messages: ChatMessage[], context?: ChatContext }
 * Response: text/event-stream — SseEvent JSON lines
 * Credits: 1 MCU deducted per completed chat session
 *
 * Context management: AFTER credit deduction, BEFORE LLM call.
 * Checks token count; if over 80% of context limit, trims/summarizes oldest messages.
 * After response, triggers async memory consolidation.
 *
 * @module app/api/v1/agent-chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveLlmRoute, type ResolveLlmRouteOptions } from '@/forest/agent-chat/llm-router';
import { formatStream, serializeSseEvent, openAiStreamToChunks } from '@/forest/agent-chat/stream-formatter';
import { buildSystemPrompt } from '@/forest/agent-chat/system-prompt';
import { deductCredits, getBalance } from '@/tree/mcu/credits-repo';
import { getContextManager, type ContextCheckResult } from '@/forest/agent-chat/context-manager';
import { getMemoryConsolidationService } from '@/forest/agent-chat/memory-consolidation-service';
import type { ChatMessage, ChatContext, SseEvent } from '@/forest/agent-chat/types';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

// ── Zod schema ─────────────────────────────────────────────────────────────────

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000),
});

const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(100),
  context: z
    .object({
      currentPage: z.string().optional(),
      installationId: z.string().optional(),
      locale: z.string().optional(),
    })
    .optional(),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Emit a single SSE event string */
function emit(event: SseEvent): string {
  return serializeSseEvent(event);
}

/**
 * Build the full message array when consolidation has occurred.
 * Keeps system prompt + optional summary + last N recent messages.
 */
function buildConsolidatedMessages(
  systemPrompt: string,
  originalMessages: { role: string; content: string }[],
  keepRecent: number,
  summaryContent: string,
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const conversation = originalMessages.filter((m) => m.role !== 'system');
  const recent = conversation.slice(-keepRecent);

  const result: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (summaryContent) {
    result.push({ role: 'system', content: summaryContent });
  }

  for (const m of recent) {
    result.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }

  return result;
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function postHandler(request: NextRequest): Promise<Response> {
  // Auth check
  const user = await getCurrentUser();
  if (!user) {
    return new Response(emit({ type: 'error', message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Parse + validate body
  let messages: ChatMessage[];
  let context: ChatContext;
  try {
    const raw = await request.json();
    const parsed = BodySchema.parse(raw);
    messages = parsed.messages as ChatMessage[];
    context = parsed.context ?? {};
  } catch {
    return new Response(emit({ type: 'error', message: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // ── Credit pre-deduction (BEFORE context check — atomic gate) ─────────────
  const balance = await getBalance(user.id).catch(() => null);
  if (!balance || balance.credits_remaining < 1) {
    return new Response(
      emit({ type: 'error', message: 'Insufficient MCU credits. Please top up.' }),
      { status: 402, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }
  const deducted = await deductCredits(user.id, 1, 'agent_chat_session', 'agent_chat').catch(
    () => false,
  );
  if (!deducted) {
    return new Response(
      emit({ type: 'error', message: 'Could not reserve MCU credit. Please retry.' }),
      { status: 402, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  // ── Build system prompt (needed for accurate context check) ───────────────
  const systemPrompt = await buildSystemPrompt(context, {
    userId: user.id,
    injectMemories: true,
    maxMemories: 5,
  });

  // ── Context management (AFTER credit deduction, BEFORE LLM call) ──────────
  const contextManager = getContextManager();
  const contextMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  let contextResult: ContextCheckResult;
  try {
    contextResult = contextManager.checkContext(contextMessages, systemPrompt);
  } catch {
    // Graceful degradation: proceed without consolidation.
    contextResult = {
      withinLimit: true,
      currentTokens: 0,
      limitTokens: 8192,
      action: 'none',
    };
  }

  // Resolve LLM route — context-aware: pass estimated token count for model selection.
  let llmRoute: Awaited<ReturnType<typeof resolveLlmRoute>>;
  try {
    const routeOptions: ResolveLlmRouteOptions = {
      estimatedTokens: contextResult.currentTokens,
    };
    llmRoute = await resolveLlmRoute(user.id, routeOptions);
  } catch {
    return new Response(emit({ type: 'error', message: 'No LLM provider configured' }), {
      status: 503,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // ── Consolidate messages if over budget ──────────────────────────────────
  let fullMessages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  let summaryContent: string | undefined;
  try {
    if (contextResult.action !== 'none') {
      // Over budget — trim and optionally summarize.
      const trimmed = await contextManager.trimMessages(
        contextMessages,
        systemPrompt,
        undefined,
        contextResult.limitTokens,
      );
      fullMessages = trimmed;

      if (contextResult.action === 'summarize+trim') {
        const { summary } = await contextManager.summarizeOlder(
          contextMessages,
          contextManager['minRecent'],
        );
        summaryContent = summary.content;
        // Rebuild with summary injected between system prompt and recent messages.
        fullMessages = buildConsolidatedMessages(
          systemPrompt,
          contextMessages,
          contextManager['minRecent'],
          summaryContent,
        );
      }
    } else {
      // Within budget — use full messages.
      fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
    }
  } catch {
    // Graceful degradation: proceed with full messages on consolidation failure.
    fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  // Track the full conversation for post-chat memory consolidation.
  const fullConversation: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Credit already deducted above (pre-deduct gate). Stream is now safe.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Call LLM provider (OpenAI-compat for all three)
        const response = await fetch(`${llmRoute.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${llmRoute.apiKey}`,
          },
          body: JSON.stringify({
            model: llmRoute.model,
            messages: fullMessages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.7,
          }),
        });

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => 'upstream error');
          controller.enqueue(encoder.encode(emit({ type: 'error', message: errText })));
          controller.close();
          return;
        }

        // Pipe through stream formatter (credit already pre-deducted above).
        const chunks = openAiStreamToChunks(response.body);
        for await (const event of formatStream(chunks)) {
          controller.enqueue(encoder.encode(emit(event)));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(encoder.encode(emit({ type: 'error', message: msg })));
      } finally {
        controller.close();
      }
    },
  });

  // Trigger post-chat memory consolidation (fire-and-forget, non-blocking).
  const consolidationService = getMemoryConsolidationService();
  const conversationId = `${user.id}:${Date.now()}`;
  consolidationService.consolidateFireAndForget(conversationId, fullConversation, user.id);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const POST = withRateLimit(
  postHandler as unknown as (request: NextRequest) => Promise<NextResponse>,
  { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } },
);
