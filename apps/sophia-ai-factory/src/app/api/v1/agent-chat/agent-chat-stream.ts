/**
 * SSE stream builder for the agent-chat endpoint.
 * Extracted to keep route.ts under 200 LOC.
 * @module app/api/v1/agent-chat/agent-chat-stream
 */

import { ToolRegistry, SophiaToolExecutor } from '@/forest/agent-chat/tool-use-loop';
import type { SseEvent } from '@/forest/agent-chat/types';
import { emit } from './agent-chat-helpers';
import { runToolUseLoop } from './agent-chat-llm';

interface BuildStreamOptions {
  fullMessages: Array<{ role: string; content: string }>;
  userId: string;
  llmRoute: { baseUrl: string; apiKey: string; model: string };
}

/**
 * Create an SSE ReadableStream that streams the agent-chat response.
 * Supports both tool-use loop and plain streaming paths.
 */
export function buildAgentChatStream(options: BuildStreamOptions): ReadableStream {
  const { fullMessages, userId, llmRoute } = options;
  const encoder = new TextEncoder();
  const executorInstance = new SophiaToolExecutor();
  const registry = new ToolRegistry(executorInstance);

  return new ReadableStream({
    async start(controller) {
      try {
        const tools = registry.getOpenAITools();
        const useToolLoop = tools.length > 0;

        const emitToClient = (event: SseEvent) => {
          controller.enqueue(encoder.encode(emit(event)));
        };

        if (useToolLoop) {
          await runToolUseLoop(
            fullMessages,
            userId,
            llmRoute,
            registry,
            executorInstance,
            encoder,
            emitToClient,
          );
        } else {
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

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(decoder.decode(value, { stream: true })));
          }
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(encoder.encode(emit({ type: 'error', message: msg })));
        controller.close();
      }
    },
  });
}
