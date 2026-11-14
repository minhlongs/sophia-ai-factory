/**
 * Single-round LLM provider caller with tool-use support.
 * @module app/api/v1/agent-chat/agent-chat-llm-caller
 */

import { formatStream, openAiStreamToChunks } from '@/forest/agent-chat/stream-formatter';
import type { SseEvent } from '@/forest/agent-chat/types';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
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

function resolveEffectiveRoute(options: LlmCallOptions): {
  effectiveModel: string;
  routeSelection?: TieredByokRouteSelection;
} {
  if (!options.taskKind) {
    return { effectiveModel: options.llmRoute.model };
  }
  const routeSelection = selectTieredByokRoute({
    taskKind: options.taskKind,
    baselineModel: options.llmRoute.model,
    keyRef: options.userId,
    budget: options.budget,
    systemPromptCacheable: options.systemPromptCacheable,
  });
  if (!routeSelection.resilientAllowed) {
    throw new Error(`BYOK_ROUTE_BLOCKED: ${routeSelection.reason}`);
  }
  const isOpenRouterUrl = options.llmRoute.baseUrl.toLowerCase().includes('openrouter.ai');
  const effectiveModel =
    isOpenRouterUrl || routeSelection.model === options.llmRoute.model
      ? routeSelection.model
      : options.llmRoute.model;
  return { effectiveModel, routeSelection };
}

async function executeUpstreamCompletion(params: {
  baseUrl: string;
  apiKey: string;
  userId: string;
  effectiveModel: string;
  routeSelection?: TieredByokRouteSelection;
  requestBody: Record<string, unknown>;
}): Promise<Response> {
  const { baseUrl, apiKey, userId, effectiveModel, routeSelection, requestBody } = params;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (routeSelection) {
      recordTieredRouteOutcome({ keyRef: userId, model: effectiveModel, ok: false, failureKind: classifyError(err) });
    }
    throw err;
  }

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
  return response;
}

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

  const { effectiveModel, routeSelection } = resolveEffectiveRoute(options);
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
    ...(routeSelection?.cacheControl ? { cache_control: { type: routeSelection.cacheControl } } : {}),
  };
  if (toolCheck.value.tools && toolCheck.value.tools.length > 0) {
    requestBody.tools = toolCheck.value.tools;
    requestBody.tool_choice = toolCheck.value.toolChoice ?? 'auto';
  }

  const response = await executeUpstreamCompletion({
    baseUrl: llmRoute.baseUrl,
    apiKey: llmRoute.apiKey,
    userId,
    effectiveModel,
    routeSelection,
    requestBody,
  });

  const chunks = openAiStreamToChunks(response.body!);
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
