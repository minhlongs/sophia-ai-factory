/**
 * @sophia/raas-sdk — MissionStream: SSE helper for real-time mission events.
 *
 * Works in modern browsers natively.
 * In Node.js 18+ the built-in EventSource is available (or pass a polyfill).
 *
 * Usage:
 *   const stream = new MissionStream(baseUrl, apiKey, missionId);
 *   stream.onStatus = (e) => console.log('status →', e.data);
 *   stream.onResult = (e) => { console.log(e.data); stream.close(); };
 *   stream.connect();
 */

import type { StreamEvent } from './types.js';

export type StreamEventHandler = (event: StreamEvent) => void;

/** Options for MissionStream construction. */
export interface MissionStreamOptions {
  /** Auto-reconnect on unexpected close. Default: true */
  autoReconnect?: boolean;
  /** Max reconnect attempts before giving up. Default: 5 */
  maxReconnects?: number;
  /** Base delay (ms) between reconnects — doubles each attempt. Default: 1000 */
  reconnectDelayMs?: number;
}

/**
 * Typed SSE client for a single mission's event stream.
 *
 * The server pushes `data: <json>` events on the path:
 *   GET /api/v1/missions/:id/stream
 * Header:  Authorization: Bearer <apiKey>
 *
 * Because native EventSource doesn't support custom headers, this class uses
 * fetch + ReadableStream to read the SSE body manually, preserving auth.
 */
export class MissionStream {
  onStatus: StreamEventHandler | null = null;
  onStep: StreamEventHandler | null = null;
  onResult: StreamEventHandler | null = null;
  onError: StreamEventHandler | null = null;
  onHeartbeat: StreamEventHandler | null = null;

  private readonly url: string;
  private readonly apiKey: string;
  private readonly autoReconnect: boolean;
  private readonly maxReconnects: number;
  private readonly reconnectDelayMs: number;

  private abortController: AbortController | null = null;
  private reconnectCount = 0;
  private closed = false;

  constructor(baseUrl: string, apiKey: string, missionId: string, opts: MissionStreamOptions = {}) {
    const base = baseUrl.replace(/\/$/, '');
    this.url = `${base}/api/v1/missions/${missionId}/stream`;
    this.apiKey = apiKey;
    this.autoReconnect = opts.autoReconnect ?? true;
    this.maxReconnects = opts.maxReconnects ?? 5;
    this.reconnectDelayMs = opts.reconnectDelayMs ?? 1000;
  }

  /** Open the SSE connection. Safe to call multiple times (no-ops if already open). */
  connect(): void {
    if (this.closed) return;
    this._openStream();
  }

  /** Permanently close the stream — disables auto-reconnect. */
  close(): void {
    this.closed = true;
    this.abortController?.abort();
    this.abortController = null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _openStream(): void {
    this.abortController = new AbortController();
    this._fetchStream(this.abortController.signal).catch((err: unknown) => {
      if (this.closed) return;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        this._dispatchError(String(err));
        this._maybeReconnect();
      }
    });
  }

  private async _fetchStream(signal: AbortSignal): Promise<void> {
    const res = await fetch(this.url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal,
    });

    if (!res.ok) {
      throw new Error(`SSE connect failed: HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('SSE: response body is null');

    const decoder = new TextDecoder();
    let buffer = '';

    // Reset reconnect counter on successful connection
    this.reconnectCount = 0;

    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = this._processBuffer(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    // Stream ended naturally — reconnect if enabled
    if (!this.closed) this._maybeReconnect();
  }

  /** Parse complete SSE messages from the buffer; return leftover. */
  private _processBuffer(buf: string): string {
    const messages = buf.split('\n\n');
    // Last element may be incomplete — keep it
    const leftover = messages.pop() ?? '';

    for (const msg of messages) {
      const dataLine = msg.split('\n').find((l) => l.startsWith('data: '));
      if (!dataLine) continue;
      const raw = dataLine.slice('data: '.length).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const event = JSON.parse(raw) as StreamEvent;
        this._dispatch(event);
      } catch {
        // Ignore malformed JSON frames
      }
    }
    return leftover;
  }

  private _dispatch(event: StreamEvent): void {
    switch (event.type) {
      case 'status':    this.onStatus?.(event); break;
      case 'step':      this.onStep?.(event); break;
      case 'result':    this.onResult?.(event); break;
      case 'error':     this.onError?.(event); break;
      case 'heartbeat': this.onHeartbeat?.(event); break;
    }
  }

  private _dispatchError(message: string): void {
    this.onError?.({ type: 'error', data: { message } });
  }

  private _maybeReconnect(): void {
    if (this.closed || !this.autoReconnect) return;
    if (this.reconnectCount >= this.maxReconnects) {
      this._dispatchError(`Max reconnects (${this.maxReconnects}) reached`);
      return;
    }
    const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectCount);
    this.reconnectCount++;
    setTimeout(() => {
      if (!this.closed) this._openStream();
    }, delay);
  }
}
