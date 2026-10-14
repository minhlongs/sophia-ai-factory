'use client';

/**
 * useCampaignStream Hook Implementation
 *
 * Layer: forest/hooks/campaign-stream
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CampaignStreamEvent } from '@/forest/streaming/campaign-stream-types';
import {
  type UseCampaignStreamResult,
  MAX_BACKOFF_MS,
  MAX_EVENTS,
  MAX_RETRIES,
  RECONNECT_BASE_MS,
} from './types';
import { parseCampaignStreamEvent } from './event-parser';

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

  useEffect(() => {
    campaignIdRef.current = campaignId;
  }, [campaignId]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const id = campaignIdRef.current;
    if (!id) return;

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
      const event = parseCampaignStreamEvent(e.data, campaignIdRef.current ?? '');
      if (event) {
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      }
    };

    es.addEventListener('error', () => {
      // Handled via onerror
    });

    es.onerror = () => {
      es.close();
      if (!mountedRef.current) return;
      setConnected(false);

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
  }, [events]);

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
