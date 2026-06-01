/**
 * Agent Chat Hook — useAgentChat
 *
 * Manages conversation state and SSE streaming from /api/v1/agent-chat.
 * Uses fetch + getReader() (not EventSource, which doesn't support POST).
 * Chat messages are session-only (not persisted server-side).
 *
 * @module components/agent-sidebar/use-agent-chat
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, SseEvent } from '@/land/agent-chat/types';

export interface UseAgentChatReturn {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  sendMessage: (content: string, currentPage?: string) => Promise<void>;
  clearMessages: () => void;
}

function parseSseChunk(raw: string): SseEvent[] {
  return raw
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice('data: '.length)) as SseEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is SseEvent => e !== null);
}

export function useAgentChat(): UseAgentChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream on unmount to prevent HTTP connection leak
  // that would keep the document `load` event from firing.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(async (content: string, currentPage?: string) => {
    if (!content.trim() || sending) return;

    setError(null);
    setSending(true);

    const userMsg: ChatMessage = { role: 'user', content: content.trim() };
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', reasoning: undefined };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/v1/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content })),
          context: { currentPage },
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partial = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partial += decoder.decode(value, { stream: true });
        const lines = partial.split('\n\n');
        partial = lines.pop() ?? '';

        for (const chunk of lines) {
          const events = parseSseChunk(chunk);
          for (const event of events) {
            if (event.type === 'token') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + event.data };
                }
                return next;
              });
            } else if (event.type === 'reasoning') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    reasoning: (last.reasoning ?? '') + event.data,
                  };
                }
                return next;
              });
            } else if (event.type === 'error') {
              setError(event.message);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [messages, sending]);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sending, error, sendMessage, clearMessages };
}
