'use client';

/**
 * useCampaignStream — EventSource hook for SSE campaign progress.
 *
 * Connects to `/api/stream/campaigns/[id]`, parses campaign-specific
 * events, and exposes them via React state. Auto-reconnects with
 * exponential backoff (1 s base, 30 s cap, +/-20% jitter), max 5 retries.
 *
 * Cleanup on unmount: closes EventSource, clears reconnect timer.
 *
 * @param campaignId — UUID of the campaign to stream.
 * @returns { events, connected, clearEvents, error }
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  CampaignStreamEvent,
  ProgressUpdateEvent,
  StatusChangeEvent,
  StepCompleteEvent,
  ErrorEvent,
} from '@/forest/streaming/campaign-stream-types';

const RECONNECT_BASE_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 5;
const MAX_EVENTS = 500;

export interface UseCampaignStreamResult {
  /** All received events, newest first. */
  events: CampaignStreamEvent[];
  /** True while the EventSource connection is open. */
  connected: boolean;
  /** Last stream error (if any). Null when connected or not yet attempted. */
  error: string | null;
  /** Clear the accumulated events buffer. */
  clearEvents: () => void;
}

export function useCampaignStream(
  campaignId: string | null,
): UseCampaignStreamResult {
  const [events, setEvents] = useState<CampaignStreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const campaignIdRef = useRef(campaignId);

  // Keep ref in sync so the reconnect callback always sees the latest id
  useEffect(() => {
    campaignIdRef.current = campaignId;
  }, [campaignId]);

  const parseEvent = useCallback(
    (raw: string): CampaignStreamEvent | null => {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const type = parsed.type as string;

        if (!type) return null;

        // Heartbeats are internal — skip adding to the visible buffer
        if (type === 'heartbeat') return null;

        // Stream end — include so consumers can detect closure
        if (type === 'stream_end') {
          return {
            type: 'stream_end',
            timestamp: String(parsed.timestamp ?? new Date().toISOString()),
            campaignId: String(parsed.campaignId ?? campaignIdRef.current ?? ''),
            finalStatus: String(parsed.finalStatus ?? 'unknown'),
            finalProgress: typeof parsed.finalProgress === 'number' ? parsed.finalProgress : 0,
          };
        }

        // Error events
        if (type === 'error') {
          return {
            type: 'error',
            timestamp: String(parsed.timestamp ?? new Date().toISOString()),
            campaignId: String(parsed.campaignId ?? campaignIdRef.current ?? ''),
            code: String(parsed.code ?? 'UNKNOWN'),
            message: String(parsed.message ?? 'Unknown error'),
            terminal: parsed.terminal === true,
          } as ErrorEvent;
        }

        // Progress update
        if (type === 'progress_update') {
          return {
            type: 'progress_update',
            timestamp: String(parsed.timestamp ?? new Date().toISOString()),
            campaignId: String(parsed.campaignId ?? campaignIdRef.current ?? ''),
            progress: typeof parsed.progress === 'number' ? parsed.progress : 0,
            label: String(parsed.label ?? ''),
            currentStep: parsed.currentStep ? String(parsed.currentStep) : undefined,
          } as ProgressUpdateEvent;
        }

        // Status change
        if (type === 'status_change') {
          return {
            type: 'status_change',
            timestamp: String(parsed.timestamp ?? new Date().toISOString()),
            campaignId: String(parsed.campaignId ?? campaignIdRef.current ?? ''),
            previousStatus: String(parsed.previousStatus ?? ''),
            status: String(parsed.status ?? ''),
          } as StatusChangeEvent;
        }

        // Step complete
        if (type === 'step_complete') {
          let metadata: Record<string, unknown> = {};
          if (parsed.metadata && typeof parsed.metadata === 'object') {
            metadata = parsed.metadata as Record<string, unknown>;
          }
          return {
            type: 'step_complete',
            timestamp: String(parsed.timestamp ?? new Date().toISOString()),
            campaignId: String(parsed.campaignId ?? campaignIdRef.current ?? ''),
            step: String(parsed.step ?? ''),
            completedAt: String(parsed.completedAt ?? parsed.timestamp ?? new Date().toISOString()),
            metadata,
          } as StepCompleteEvent;
        }

        // Unknown type — pass through with minimal typing
        return {
          type: type as CampaignStreamEvent['type'],
          timestamp: String(parsed.timestamp ?? new Date().toISOString()),
          campaignId: String(parsed.campaignId ?? campaignIdRef.current ?? ''),
        } as CampaignStreamEvent;
      } catch {
        return null;
      }
    },
    [],
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const id = campaignIdRef.current;
    if (!id) return;

    // Clean up any existing connection
    esRef.current?.close();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const es = new EventSource(`/api/stream/campaigns/${encodeURIComponent(id)}`);
    esRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      retriesRef.current = 0;
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e: MessageEvent<string>) => {
      if (!mountedRef.current) return;
      const event = parseEvent(e.data);
      if (event) {
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      }
    };

    // SSE servers sometimes send named events via addEventListener
    es.addEventListener('error', () => {
      // Handled below via onerror
    });

    es.onerror = () => {
      es.close();
      if (!mountedRef.current) return;
      setConnected(false);

      // Terminal error from server — stop retrying
      const lastError = events[0];
      if (lastError?.type === 'error' && lastError.terminal) {
        setError(lastError.message);
        return;
      }

      if (retriesRef.current >= MAX_RETRIES) {
        setError('Connection lost — max retries reached');
        return;
      }

      retriesRef.current += 1;
      const backoff =
        retriesRef.current === 1
          ? RECONNECT_BASE_MS
          : Math.min(
              RECONNECT_BASE_MS * Math.pow(2, retriesRef.current - 1),
              MAX_BACKOFF_MS,
            );
      const jitter = backoff * (0.8 + Math.random() * 0.4);

      timerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, jitter);
    };
  }, [parseEvent, events]);

  useEffect(() => {
    mountedRef.current = true;
    setError(null);

    if (campaignId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
   
  }, [campaignId, connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, error, clearEvents };
}
