/**
 * POST /api/v1/agent-chat
 *
 * SSE-streaming chat endpoint routing through BYO local LLM,
 * DeepSeek R1 cloud, or Anthropic Claude fallback.
 *
 * Auth: session via getCurrentUser()
 * Body: { messages: ChatMessage[], context?: ChatContext }
 * Response: text/event-stream — SseEvent JSON lines
 * Credits: 1 MCU deducted per completed chat session
 *
 * @module app/api/v1/agent-chat
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveLlmRoute } from '@/lib/agent-chat/llm-router';
import { formatStream, serializeSseEvent, openAiStreamToChunks } from '@/lib/agent-chat/stream-formatter';
import { buildSystemPrompt } from '@/lib/agent-chat/system-prompt';
import { deductCredits, getBalance } from '@/lib/mcu/credits-repo';
import type { ChatMessage, ChatContext, SseEvent } from '@/lib/agent-chat/types';

export const dynamic = 'force-dynamic';

// Zod schema for request body
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

/** Emit a single SSE event string */
function emit(event: SseEvent): string {
  return serializeSseEvent(event);
}

export async function POST(request: NextRequest): Promise<Response> {
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

  // Pre-deduct 1 credit BEFORE calling upstream LLM. Prevents zero-balance users
  // from consuming real $ tokens. We do not refund partial streams — full session
  // is the unit. Race: concurrent chats may both pass balance check; deductCredits
  // is the source-of-truth and will fail one of them with insufficient_balance.
  const balance = await getBalance(user.id).catch(() => null);
  if (!balance || balance.credits_remaining < 1) {
    return new Response(emit({ type: 'error', message: 'Insufficient MCU credits. Please top up.' }), {
      status: 402,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
  const deducted = await deductCredits(user.id, 1, 'agent_chat_session', 'agent_chat').catch(() => false);
  if (!deducted) {
    return new Response(emit({ type: 'error', message: 'Could not reserve MCU credit. Please retry.' }), {
      status: 402,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Resolve LLM route
  let llmRoute: Awaited<ReturnType<typeof resolveLlmRoute>>;
  try {
    llmRoute = await resolveLlmRoute(user.id);
  } catch {
    return new Response(emit({ type: 'error', message: 'No LLM provider configured' }), {
      status: 503,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(context);

  const fullMessages = [
    { role: 'system' as const, content: systemPrompt },
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
