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
  llmRoute: { baseUrl: string; apiKey: string; model: string; provider?: string };
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

function inferRouteProvider(baseUrl: string, explicitProvider?: string): { provider: string; isOpenRouter: boolean } {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('openrouter.ai')) return { provider: explicitProvider ?? 'openrouter', isOpenRouter: true };
  if (explicitProvider) return { provider: explicitProvider, isOpenRouter: false };
  if (lower.includes('deepseek.com')) return { provider: 'deepseek', isOpenRouter: false };
  if (lower.includes('anthropic.com')) return { provider: 'anthropic', isOpenRouter: false };
  if (lower.includes('openai.com')) return { provider: 'openai', isOpenRouter: false };
  return { provider: 'llm-upstream', isOpenRouter: false };
}

function resolveEffectiveRoute(options: LlmCallOptions): {
  effectiveModel: string;
  provider: string;
  isOpenRouter: boolean;
  routeSelection?: TieredByokRouteSelection;
} {
  const { provider, isOpenRouter } = inferRouteProvider(options.llmRoute.baseUrl, options.llmRoute.provider);
  if (!options.taskKind) {
    return { effectiveModel: options.llmRoute.model, provider, isOpenRouter };
  }
  const routeSelection = selectTieredByokRoute({
    taskKind: options.taskKind,
    baselineModel: options.llmRoute.model,
    provider,
    keyRef: options.userId,
    budget: options.budget,
    systemPromptCacheable: isOpenRouter ? options.systemPromptCacheable : false,
  });
  if (!routeSelection.resilientAllowed) {
    throw new Error(`BYOK_ROUTE_BLOCKED: ${routeSelection.reason}`);
  }
  const effectiveModel =
    isOpenRouter || routeSelection.model === options.llmRoute.model
      ? routeSelection.model
      : options.llmRoute.model;
  return { effectiveModel, provider, isOpenRouter, routeSelection };
}

async function executeUpstreamCompletion(params: {
  baseUrl: string;
  apiKey: string;
  provider: string;
  userId: string;
  effectiveModel: string;
  routeSelection?: TieredByokRouteSelection;
  requestBody: Record<string, unknown>;
}): Promise<Response> {
  const { baseUrl, apiKey, provider, userId, effectiveModel, routeSelection, requestBody } = params;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (routeSelection) {
      recordTieredRouteOutcome({ provider, keyRef: userId, model: effectiveModel, ok: false, failureKind: classifyError(err) });
    }
    throw err;
  }

  if (!response.ok || !response.body) {
    if (routeSelection) {
      recordTieredRouteOutcome({
        provider,
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
    recordTieredRouteOutcome({ provider, keyRef: userId, model: effectiveModel, ok: true });
  }
  return response;
}

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

  const { effectiveModel, provider, isOpenRouter, routeSelection } = resolveEffectiveRoute(options);
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
    ...(isOpenRouter && routeSelection?.cacheControl ? { cache_control: { type: routeSelection.cacheControl } } : {}),
  };
  if (toolCheck.value.tools && toolCheck.value.tools.length > 0) {
    requestBody.tools = toolCheck.value.tools;
    requestBody.tool_choice = toolCheck.value.toolChoice ?? 'auto';
  }

  const response = await executeUpstreamCompletion({
    baseUrl: llmRoute.baseUrl,
    apiKey: llmRoute.apiKey,
    provider,
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
