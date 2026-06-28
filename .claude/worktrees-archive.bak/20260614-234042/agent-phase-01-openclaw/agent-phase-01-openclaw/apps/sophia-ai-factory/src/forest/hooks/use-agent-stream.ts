'use client';

/**
 * useAgentStream — EventSource hook for SSE agent task feed
 * Auto-reconnects with 5s backoff, max 5 retries.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AgentEvent {
  type: string;
  taskId?: string;
  agentId?: string;
  status?: string;
  input?: string;
  errorMessage?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  receivedAt: string;
}

interface UseAgentStreamResult {
  events: AgentEvent[];
  connected: boolean;
  clearEvents: () => void;
}

const MAX_EVENTS = 200;
const RECONNECT_MS = 5_000;
const MAX_RETRIES = 5;

export function useAgentStream(): UseAgentStreamResult {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const es = new EventSource('/api/agents/stream');
    esRef.current = es;

    es.onopen = () => {
      retriesRef.current = 0;
      setConnected(true);
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data as string) as Record<string, unknown>;
        if (parsed.type === 'heartbeat' || parsed.type === 'connected' || parsed.type === 'stream_end') {
          return;
        }
        const event: AgentEvent = {
          type: String(parsed.type ?? 'unknown'),
          taskId: parsed.taskId ? String(parsed.taskId) : undefined,
          agentId: parsed.agentId ? String(parsed.agentId) : undefined,
          status: parsed.status ? String(parsed.status) : undefined,
          input: parsed.input ? String(parsed.input) : undefined,
          errorMessage: parsed.errorMessage != null ? String(parsed.errorMessage) : null,
          createdAt: parsed.createdAt ? String(parsed.createdAt) : undefined,
          completedAt: parsed.completedAt != null ? String(parsed.completedAt) : null,
          receivedAt: new Date().toISOString(),
        };
        setEvents(prev => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // Malformed JSON — skip
      }
    };

    es.onerror = () => {
      es.close();
      setConnected(false);
      if (!mountedRef.current) return;
      if (retriesRef.current >= MAX_RETRIES) return;
      retriesRef.current += 1;
      timerRef.current = setTimeout(connect, RECONNECT_MS);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}
