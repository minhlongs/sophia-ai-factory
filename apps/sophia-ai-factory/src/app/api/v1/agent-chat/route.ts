/**
 * POST /api/v1/agent-chat
 *
 * SSE-streaming chat endpoint with tool-use loop support.
 * Auth: session via getCurrentUser()
 * Body: { messages: ChatMessage[], context?: ChatContext }
 * Response: text/event-stream — SseEvent JSON lines
 * Credits: 1 MCU deducted per completed chat session
 *
 * @module app/api/v1/agent-chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveLlmRoute, type ResolveLlmRouteOptions } from '@/forest/agent-chat/llm-router';
import { buildSystemPrompt } from '@/forest/agent-chat/system-prompt';
import { deductCredits, getBalance } from '@/tree/mcu/credits-repo';
import { getContextManager, type ContextCheckResult } from '@/forest/agent-chat/context-manager';
import type { ChatMessage, ChatContext } from '@/forest/agent-chat/types';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { BodySchema } from './agent-chat-schema';
import { emit, buildConsolidatedMessages } from './agent-chat-helpers';
import { buildAgentChatStream } from './agent-chat-stream';

// Re-export extracted modules for barrel compatibility
export { BodySchema, ChatMessageSchema } from './agent-chat-schema';
export { emit, buildConsolidatedMessages, extractToolCallsFromEvents, buildToolResultMessages } from './agent-chat-helpers';
export { callLlmWithTools, runToolUseLoop } from './agent-chat-llm';
export { buildAgentChatStream } from './agent-chat-stream';
export type { LlmCallOptions, LlmCallResult } from './agent-chat-llm';

export const dynamic = 'force-dynamic';

async function postHandler(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(emit({ type: 'error', message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

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

  // Credit gate
  const balance = await getBalance(user.id).catch(() => null);
  if (!balance || balance.credits_remaining < 1) {
    return new Response(
      emit({ type: 'error', message: 'Insufficient MCU credits. Please top up.' }),
      { status: 402, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  const deducted = await deductCredits(user.id, 1, 'agent_chat_session', 'agent_chat').catch(() => false);
  if (!deducted) {
    return new Response(
      emit({ type: 'error', message: 'Could not reserve MCU credit. Please retry.' }),
      { status: 402, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(context, {
    userId: user.id,
    injectMemories: true,
    maxMemories: 5,
  });

  // Context management
  const contextManager = getContextManager();
  const contextMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  let contextResult: ContextCheckResult;
  try {
    contextResult = contextManager.checkContext(contextMessages, systemPrompt);
  } catch {
    contextResult = { withinLimit: true, currentTokens: 0, limitTokens: 8192, action: 'none' };
  }

  // Resolve LLM route
  let llmRoute: Awaited<ReturnType<typeof resolveLlmRoute>>;
  try {
    llmRoute = await resolveLlmRoute(user.id, { estimatedTokens: contextResult.currentTokens } as ResolveLlmRouteOptions);
  } catch {
    return new Response(emit({ type: 'error', message: 'No LLM provider configured' }), {
      status: 503,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Build message array
  let fullMessages: Array<{ role: string; content: string }>;
  try {
    if (contextResult.action !== 'none') {
      const trimmed = await contextManager.trimMessages(contextMessages, systemPrompt, undefined, contextResult.limitTokens);
      if (contextResult.action === 'summarize+trim') {
        const { summary } = await contextManager.summarizeOlder(contextMessages, contextManager['minRecent']);
        fullMessages = buildConsolidatedMessages(systemPrompt, contextMessages, contextManager['minRecent'], summary.content);
      } else {
        fullMessages = [{ role: 'system', content: systemPrompt }, ...trimmed];
      }
    } else {
      fullMessages = [{ role: 'system', content: systemPrompt }, ...contextMessages];
    }
  } catch {
    fullMessages = [{ role: 'system', content: systemPrompt }, ...contextMessages];
  }

  // Create SSE stream
  const stream = buildAgentChatStream({ fullMessages, userId: user.id, llmRoute });

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
  {
    addHeaders: true,
    config: { intervalMs: 60_000, maxRequests: 20 },
  },
);
