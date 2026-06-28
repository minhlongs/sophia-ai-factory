/**
 * Sophia AI Factory TypeScript SDK
 *
 * Client for the /api/v1/missions REST API.
 *
 * @example
 * ```ts
 * import { SophiaClient } from '@/sdk';
 *
 * const sophia = new SophiaClient({ apiKey: 'mk_live_...' });
 * const mission = await sophia.missions.create({ command: 'proposal:create', params: { niche: 'SaaS' } });
 * for await (const event of sophia.missions.stream(mission.id)) {
 *   console.log(event);
 * }
 * ```
 */

export interface SophiaClientOptions {
  /** Your Sophia API key (from /dashboard/api-keys) */
  apiKey: string;
  /** Override API base URL. Defaults to https://sophia.agencyos.network */
  baseUrl?: string;
}

export interface Mission {
  id: string;
  command: string;
  params: Record<string, unknown> | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  result: Record<string, unknown> | null;
  error: string | null;
  credits_used: number;
  credits_required?: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  webhook_url: string | null;
  webhook_fired_at: number | null;
  eta_seconds?: number;
  stream_url?: string;
}

export interface CreateMissionOptions {
  command: string;
  params?: Record<string, unknown>;
  webhook_url?: string;
}

export interface ListMissionsOptions {
  status?: string;
  command?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedMissions {
  missions: Mission[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
}

export interface MissionEvent {
  event: string;
  data: Record<string, unknown>;
}

/**
 * Main Sophia API client.
 */
export class SophiaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: SophiaClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://sophia.agencyos.network').replace(/\/$/, '');
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      ...options,
      headers: { ...this.authHeaders, ...(options?.headers as Record<string, string> | undefined) },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Sophia API error ${resp.status}: ${body.slice(0, 300)}`);
    }

    return resp.json() as Promise<T>;
  }

  /** Mission operations */
  readonly missions = {
    /**
     * Create a new mission (async execution).
     * Returns immediately with mission id + status='pending'.
     */
    create: async (opts: CreateMissionOptions): Promise<Mission> => {
      return this.request<Mission>('/api/v1/missions', {
        method: 'POST',
        body: JSON.stringify(opts),
      });
    },

    /**
     * Get mission state by id.
     */
    get: async (id: string): Promise<Mission> => {
      return this.request<Mission>(`/api/v1/missions/${id}`);
    },

    /**
     * Stream real-time mission status updates via SSE.
     * Yields MissionEvent objects until terminal state or timeout.
     */
    stream: async function* (this: SophiaClient, id: string): AsyncGenerator<MissionEvent> {
      const url = `${this.baseUrl}/api/v1/missions/${id}/stream`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Stream error ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
                yield { event: currentEvent || 'message', data };
                if (currentEvent === 'done' || currentEvent === 'timeout') return;
              } catch {
                // Skip malformed line
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }.bind(this) as (id: string) => AsyncGenerator<MissionEvent>,

    /**
     * List user's missions with optional filters.
     */
    list: async (opts?: ListMissionsOptions): Promise<PaginatedMissions> => {
      const params = new URLSearchParams();
      if (opts?.status) params.set('status', opts.status);
      if (opts?.command) params.set('command', opts.command);
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.cursor) params.set('cursor', opts.cursor);
      const qs = params.toString();
      return this.request<PaginatedMissions>(`/api/v1/missions${qs ? `?${qs}` : ''}`);
    },
  };

  /** MCU credit operations */
  readonly credits = {
    /**
     * Get current MCU credit balance.
     */
    getBalance: async (): Promise<McuBalance> => {
      return this.request<McuBalance>('/api/v1/credits');
    },
  };
}
