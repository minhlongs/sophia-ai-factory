/**
 * Single-round LLM provider caller with tool-use support.
 * @module app/api/v1/agent-chat/agent-chat-llm-caller
 */

import { formatStream, openAiStreamToChunks } from '@/forest/agent-chat/stream-formatter';
import type { SseEvent } from '@/forest/agent-chat/types';
import { classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  PROVIDER_CAPABILITIES,
  recordTieredRouteOutcome,
  sanitizeToolChoiceForRoute,
  selectTieredByokRoute,
  type ByokTaskComplexity,
  type KeyBudgetState,
  type KeyCapability,
  type TieredByokRouteSelection,
  type ToolChoiceValue,
} from '@/tree/byok';

export interface LlmCallOptions {
  messages: Array<{ role: string; content: string | Array<unknown> }>;
  tools?: Array<{
    type: string;
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  toolChoice?: ToolChoiceValue;
  userId: string;
  llmRoute: { baseUrl: string; apiKey: string; model: string };
  capabilities?: readonly KeyCapability[];
  taskKind?: ByokTaskComplexity;
  allowToolStrip?: boolean;
  budget?: KeyBudgetState;
  systemPromptCacheable?: boolean;
}

export type LlmCallResult = {
  response: Response;
  events: SseEvent[];
  stopReason: string | undefined;
  routeSelection?: TieredByokRouteSelection;
};

/**
 * Call the LLM provider and return the raw response + parsed events.
 * Supports both OpenAI-compatible and Anthropic-style streaming.
 */
export async function callLlmWithTools(options: LlmCallOptions): Promise<LlmCallResult> {
  const { messages, tools, toolChoice, userId, llmRoute } = options;

  const toolCheck = sanitizeToolChoiceForRoute({
    tools,
    toolChoice,
    capabilities: options.capabilities ?? PROVIDER_CAPABILITIES.openrouter,
    allowToolStrip: options.allowToolStrip,
  });
  if (!toolCheck.ok) {
    throw new Error(`${toolCheck.error.code}: ${toolCheck.error.message}`);
  }

  const routeSelection = options.taskKind
    ? selectTieredByokRoute({
        taskKind: options.taskKind,
        baselineModel: llmRoute.model,
        keyRef: userId,
        budget: options.budget,
        systemPromptCacheable: options.systemPromptCacheable,
      })
    : undefined;
  const effectiveModel = routeSelection ? routeSelection.model : llmRoute.model;

  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
  };

  if (toolCheck.value.tools && toolCheck.value.tools.length > 0) {
    requestBody.tools = toolCheck.value.tools;
    requestBody.tool_choice = toolCheck.value.toolChoice ?? 'auto';
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
    if (routeSelection) {
      recordTieredRouteOutcome({
        keyRef: userId,
        model: effectiveModel,
        ok: false,
        failureKind: classifyHttpStatus(response.status),
      });
    }
    const errText = await response.text().catch(() => 'upstream error');
    throw new Error(`LLM upstream error: ${errText}`);
  }

  if (routeSelection) {
    recordTieredRouteOutcome({ keyRef: userId, model: effectiveModel, ok: true });
  }

  const chunks = openAiStreamToChunks(response.body);
  const events: SseEvent[] = [];
  for await (const event of formatStream(chunks)) {
    events.push(event);
  }

  const lastContentEvent = events.filter((e) => e.type === 'token').pop();
  const stopReason = lastContentEvent
    ? (lastContentEvent.data as string).match(/"stop_reason"\s*:\s*"([^"]+)"/)?.[1]
    : undefined;

  return {
    response,
    events,
    stopReason,
    ...(routeSelection ? { routeSelection } : {}),
  };
}
