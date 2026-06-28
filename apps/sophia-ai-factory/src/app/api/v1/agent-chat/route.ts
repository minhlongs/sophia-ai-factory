/**
 * POST /api/v1/agent-chat
 *
 * SSE-streaming chat endpoint with tool-use loop support.
 *
 * Auth: session via getCurrentUser()
 * Body: { messages: ChatMessage[], context?: ChatContext }
 * Response: text/event-stream — SseEvent JSON lines
 * Credits: 1 MCU deducted per completed chat session
 *
 * Flow:
 * 1. Auth + credit check
 * 2. Build system prompt with memory injection
 * 3. Context management (trim/summarize if over budget)
 * 4. LLM call with tools available
 * 5. If response contains tool_use → execute tools → feed results back → loop
 * 6. Stream final response to client
 *
 * @module app/api/v1/agent-chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveLlmRoute, type ResolveLlmRouteOptions } from '@/forest/agent-chat/llm-router';
import { AgentToolName } from '@/forest/agent-chat/tool-registry';
import { formatStream, serializeSseEvent, openAiStreamToChunks } from '@/forest/agent-chat/stream-formatter';
import { buildSystemPrompt } from '@/forest/agent-chat/system-prompt';
import { deductCredits, getBalance } from '@/tree/mcu/credits-repo';
import { getContextManager, type ContextCheckResult } from '@/forest/agent-chat/context-manager';
import { getMemoryConsolidationService } from '@/forest/agent-chat/memory-consolidation-service';
import { ToolRegistry, SophiaToolExecutor, ToolUseLoop, MAX_TOOL_ROUNDS, type ParsedToolCall, hasToolUse } from '@/forest/agent-chat/tool-use-loop';
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

// ── LLM Call with Tool-Use Support ─────────────────────────────────────────────

interface LlmCallOptions {
  messages: Array<{ role: string; content: string | Array<unknown> }>;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
  toolChoice?: string | { type: string };
  userId: string;
  llmRoute: { baseUrl: string; apiKey: string; model: string };
}

/**
 * Call the LLM provider and return the raw response + parsed events.
 * Supports both OpenAI-compatible and Anthropic-style streaming.
 */
async function callLlmWithTools(options: LlmCallOptions): Promise<{
  response: Response;
  events: SseEvent[];
  stopReason: string | undefined;
}> {
  const { messages, tools, toolChoice, userId, llmRoute } = options;

  const requestBody: Record<string, unknown> = {
    model: llmRoute.model,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = toolChoice ?? 'auto';
  }

  const response = await fetch(`${llmRoute.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmRoute.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => 'upstream error');
    throw new Error(`LLM upstream error: ${errText}`);
  }

  // Parse streaming response into events
  const chunks = openAiStreamToChunks(response.body);
  const events: SseEvent[] = [];
  for await (const event of formatStream(chunks)) {
    events.push(event);
  }

  // Determine stop reason from the last non-done event
  const lastContentEvent = events.filter((e) => e.type === 'token').pop();
  const stopReason = lastContentEvent
    ? (lastContentEvent.data as string).match(/"stop_reason"\s*:\s*"([^"]+)"/)?.[1]
    : undefined;

  return { response, events, stopReason };
}

// ── Tool-Use Loop ──────────────────────────────────────────────────────────────

/**
 * Run the tool-use loop: call LLM → detect tool_use → execute → feed back → repeat.
 * Returns the final stream events to send to the client.
 */
async function runToolUseLoop(
  initialMessages: Array<{ role: string; content: string | Array<unknown> }>,
  userId: string,
  llmRoute: { baseUrl: string; apiKey: string; model: string },
  registry: ToolRegistry,
  executor: SophiaToolExecutor,
  encoder: TextEncoder,
  emitToClient: (event: SseEvent) => void,
): Promise<SseEvent[]> {
  const allClientEvents: SseEvent[] = [];
  let messages = [...initialMessages];
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    // Get tools for this round
    const tools = registry.getOpenAITools();

    // Call LLM with tools
    let llmResponse: { events: SseEvent[]; stopReason: string | undefined };
    try {
      const result = await callLlmWithTools({
        messages,
        tools,
        userId,
        llmRoute,
      });
      llmResponse = result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LLM call failed';
      emitToClient({ type: 'error', message: msg });
      allClientEvents.push({ type: 'error', message: msg });
      break;
    }

    // Stream content events to client (tokens + reasoning)
    for (const event of llmResponse.events) {
      if (event.type === 'token' || event.type === 'reasoning') {
        emitToClient(event);
        allClientEvents.push(event);
      }
    }

    // Check if LLM wants to use tools
    if (!hasToolUse(llmResponse.stopReason, llmResponse.events)) {
      // No tool use — we're done
      emitToClient({ type: 'done' });
      allClientEvents.push({ type: 'done' });
      break;
    }

    // Parse tool calls from the response
    const toolCalls = extractToolCallsFromEvents(llmResponse.events);
    if (toolCalls.length === 0) {
      // No parseable tool calls but stop_reason indicated tool_use — force end
      emitToClient({ type: 'done' });
      allClientEvents.push({ type: 'done' });
      break;
    }

    // Execute tools via ToolUseLoop
    const loop = new ToolUseLoop(registry, executor);
    const results = await loop.executeToolCalls(toolCalls, userId);

    // Emit tool events to client
    for (const result of results) {
      emitToClient(result);
      allClientEvents.push(result);
    }

    // Build tool result messages for the next LLM round
    const toolResultMessages = buildToolResultMessages(toolCalls, results);
    messages = [...messages, ...toolResultMessages];

    // Small delay before next round
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (round >= MAX_TOOL_ROUNDS) {
    // Hit max rounds — force completion
    emitToClient({ type: 'done' });
    allClientEvents.push({ type: 'done' });
  }

  return allClientEvents;
}

/**
 * Extract tool_calls from OpenAI-compatible streaming events.
 * Parses delta.tool_calls from the stream.
 */
function extractToolCallsFromEvents(events: SseEvent[]): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const pendingCalls = new Map<number, { id?: string; name?: string; args: string }>();

  for (const event of events) {
    if (event.type !== 'token') continue;
    const data = event.data as string;

    // Look for tool_calls in the streaming JSON
    // OpenAI format: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_xxx","function":{"name":"get_campaigns","arguments":"{}"}}]}}]}
    const toolCallMatch = data.match(/"tool_calls"\s*:\s*\[/);
    if (!toolCallMatch) continue;

    try {
      // Try to parse the full message to extract tool_calls
      const fullMatch = data.match(/"choices"\s*:\s*\[\{.*?"delta"\s*:\s*\{.*?"tool_calls"\s*:\s*(\[.*?\])/s);
      if (fullMatch) {
        const toolCallsArray = JSON.parse(fullMatch[1]) as Array<{
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;

        for (const tc of toolCallsArray) {
          const existing = pendingCalls.get(tc.index) ?? { args: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          pendingCalls.set(tc.index, existing);
        }
      }
    } catch {
      // Partial JSON — accumulate and parse later
    }
  }

  // Finalize pending calls
  for (const [, pending] of pendingCalls) {
    if (pending.id && pending.name) {
      calls.push({
        id: pending.id,
        name: pending.name as AgentToolName,
        args: pending.args ? JSON.parse(pending.args) : {},
      });
    }
  }

  return calls;
}

/**
 * Build tool result messages in OpenAI-compatible format for feeding back to LLM.
 */
function buildToolResultMessages(
  calls: ParsedToolCall[],
  results: SseEvent[],
): Array<
  | { role: 'assistant'; content: string; tool_calls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string }
> {
  const resultMap = new Map<string, SseEvent & { type: 'tool_result' }>();
  for (const r of results) {
    if (r.type === 'tool_result') {
      resultMap.set(r.data.id, r);
    }
  }

  // Build assistant message with tool_calls
  const assistantMessage: { role: 'assistant'; content: string; tool_calls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> } = {
    role: 'assistant',
    content: '',
    tool_calls: calls.map((c) => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: JSON.stringify(c.args) },
    })),
  };

  // Build tool result messages
  const toolResults: Array<{ role: 'tool'; tool_call_id: string; content: string }> = calls.map((c) => {
    const result = resultMap.get(c.id);
    const data = result?.type === 'tool_result' ? result.data : null;
    const content = data
      ? typeof data.content === 'string'
        ? data.content
        : JSON.stringify(data.content)
      : 'Unknown error';
    return {
      role: 'tool',
      tool_call_id: c.id,
      content: data?.success ?? false ? content : `Error: ${data?.error ?? 'Unknown'}`,
    };
  });

  return [assistantMessage, ...toolResults];
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

  // ── Build system prompt (needed for accurate context check) ────────────────
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
    contextResult = { withinLimit: true, currentTokens: 0, limitTokens: 8192, action: 'none' };
  }

  // Resolve LLM route
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
  let fullMessages: Array<{ role: string; content: string }>;
  let summaryContent: string | undefined;
  try {
    if (contextResult.action !== 'none') {
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
        fullMessages = buildConsolidatedMessages(
          systemPrompt,
          contextMessages,
          contextManager['minRecent'],
          summaryContent,
        );
      }
    } else {
      fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
    }
  } catch {
    // Graceful degradation
    fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  // Track conversation for post-chat memory consolidation
  const fullConversation: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // ── Initialize tool-use infrastructure ────────────────────────────────────
  const registry = new ToolRegistry(new SophiaToolExecutor());
  const encoder = new TextEncoder();
  const clientEvents: SseEvent[] = [];

  const emitToClient = (event: SseEvent) => {
    clientEvents.push(event);
  };

  // ── Stream response ────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Check if tools should be enabled (user has configured providers)
        const tools = registry.getOpenAITools();
        const useToolLoop = tools.length > 0;

        if (useToolLoop) {
          // Run tool-use loop
          await runToolUseLoop(
            fullMessages,
            user.id,
            llmRoute,
            registry,
            new SophiaToolExecutor(),
            encoder,
            emitToClient,
          );
        } else {
          // Original streaming path (no tools configured)
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

          const chunks = openAiStreamToChunks(response.body);
          for await (const event of formatStream(chunks)) {
            controller.enqueue(encoder.encode(emit(event)));
          }
          controller.enqueue(encoder.encode(emit({ type: 'done' })));
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
  {
    addHeaders: true,
    config: { intervalMs: 60_000, maxRequests: 20 },
  },
);
