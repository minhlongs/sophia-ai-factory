/**
 * Sophia AI Factory TypeScript SDK
 *
 * Canonical unified client for the Sophia AI Factory platform API.
 * Supports:
 * - Missions lifecycle (create, get, streamEvents/stream, list)
 * - MCU Credits (balance/getBalance, consume)
 * - High-level AI algorithms (affiliateDescription, translate, cloneVoice, seoScript, liveStats, schedulePublish, registerChannel)
 *
 * @example
 * ```ts
 * import { SophiaClient } from '@/sdk';
 *
 * const sophia = new SophiaClient({ apiKey: 'mk_live_...' });
 * const balance = await sophia.credits.balance();
 * const mission = await sophia.missions.create({ command: 'video:create', params: { title: 'Intro' } });
 * for await (const event of sophia.missions.streamEvents(mission.id)) {
 *   console.log(event);
 * }
 * ```
 */

export interface SophiaClientOptions {
  /** Your Sophia API key (from /dashboard/api-keys) or bearer token */
  apiKey?: string;
  token?: string;
  /** Override API base URL. Defaults to https://sophia.agencyos.network */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

export type SophiaToken = string;

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class SophiaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SophiaApiError';
  }
}

// ─── Missions Types ─────────────────────────────────────────────────────────

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

export interface MissionEvent {
  event: string;
  data: Record<string, unknown>;
}

// ─── Credits Types ──────────────────────────────────────────────────────────

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
  recent_transactions?: unknown[];
}

export interface ConsumeCreditsOptions {
  amount: number;
  reason?: string;
  missionId?: string;
}

export interface ConsumeCreditsResult {
  success: boolean;
  credits_remaining: number;
  credits_consumed: number;
  transaction_id?: string;
}

// ─── Algorithms Types ───────────────────────────────────────────────────────

export interface AffiliateDescriptionOptions {
  niche?: string;
  max?: number;
}

export interface AffiliateDescription {
  description: string;
  affiliateCount: number;
}

export interface TranslateInput {
  text: string;
  fromLang: string;
  toLang: string;
  tone?: 'literal' | 'natural';
}

export interface TranslateResult {
  translated: string;
  model: string;
}

export interface VoiceCloneInput {
  name: string;
  audioUrls: string[];
  description?: string;
}

export interface VoiceCloneResult {
  voiceId: string;
  samplesUploaded: number;
}

export interface SeoScriptInput {
  topic: string;
  keywords?: string[];
  language?: 'en' | 'vi';
}

export interface SeoScriptResult {
  script: string;
  seoScore: number;
  suggestedTitles: string[];
  keywordCoverage: Array<{ keyword: string; hits: number }>;
}

export interface LiveStats {
  missionsCompleted: number;
  paidAgencies: number;
  videosGenerated: number;
  generatedAt: number;
}

export interface PublishScheduleInput {
  videoId: string;
  channelId: string;
  scheduledAt: number;
  caption?: string;
  hashtags?: string[];
}

export interface PublishScheduleResult {
  jobId: string;
  scheduledAt: number;
  status: 'scheduled';
}

export type PublishProvider =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'pinterest'
  | 'threads'
  | 'reddit'
  | 'bluesky'
  | 'mastodon'
  | 'zalo'
  | 'whatsapp';

export interface RegisterChannelInput {
  provider: PublishProvider;
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface RegisterChannelResult {
  channelId: string;
  provider: string;
  status: 'active';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

// ─── Canonical SophiaClient ─────────────────────────────────────────────────

export class SophiaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(optsOrToken: SophiaClientOptions | string, baseUrl?: string) {
    if (typeof optsOrToken === 'string') {
      this.apiKey = optsOrToken;
      this.baseUrl = (baseUrl ?? 'https://sophia.agencyos.network').replace(/\/$/, '');
      this.timeoutMs = 30000;
    } else {
      this.apiKey = optsOrToken.apiKey ?? optsOrToken.token ?? '';
      this.baseUrl = (optsOrToken.baseUrl ?? baseUrl ?? 'https://sophia.agencyos.network').replace(/\/$/, '');
      this.timeoutMs = optsOrToken.timeoutMs ?? 30000;
    }
  }

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
    ro?: RequestOptions,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timeout = ro?.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    }

    const signal = ro?.signal
      ? combineSignals([ro.signal, controller.signal])
      : controller.signal;

    try {
      const resp = await fetch(url, {
        ...options,
        signal,
        headers: {
          ...this.authHeaders,
          ...(options?.headers as Record<string, string> | undefined),
        },
      });

      if (!resp.ok) {
        let errorBody: string;
        try {
          errorBody = await resp.text();
        } catch {
          errorBody = '<failed to read response body>';
        }
        throw new SophiaApiError(
          `Sophia API error ${resp.status}: ${errorBody.slice(0, 300)}`,
          resp.status,
          errorBody,
        );
      }

      return (await resp.json()) as T;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Missions API
   */
  readonly missions = {
    /**
     * Create a new mission (async execution).
     * Returns immediately with mission id + status='pending'.
     */
    create: async (opts: CreateMissionOptions, ro?: RequestOptions): Promise<Mission> => {
      return this.request<Mission>('/api/v1/missions', {
        method: 'POST',
        body: JSON.stringify(opts),
      }, ro);
    },

    /**
     * Get mission state by id.
     */
    get: async (id: string, ro?: RequestOptions): Promise<Mission> => {
      return this.request<Mission>(`/api/v1/missions/${id}`, {}, ro);
    },

    /**
     * Stream real-time mission status updates via SSE.
     * Yields MissionEvent objects until terminal state or timeout.
     */
    stream: async function* (this: SophiaClient, id: string, ro?: RequestOptions): AsyncGenerator<MissionEvent> {
      yield* this.missions.streamEvents.call(this, id, ro);
    }.bind(this) as (id: string, ro?: RequestOptions) => AsyncGenerator<MissionEvent>,

    /**
     * Canonical alias for stream(): Stream mission events via SSE.
     */
    streamEvents: async function* (this: SophiaClient, id: string, ro?: RequestOptions): AsyncGenerator<MissionEvent> {
      const url = `${this.baseUrl}/api/v1/missions/${id}/stream`;
      const timeout = ro?.timeoutMs ?? this.timeoutMs;
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          controller.abort(new Error(`Stream timeout after ${timeout}ms`));
        }, timeout);
      }

      const signal = ro?.signal
        ? combineSignals([ro.signal, controller.signal])
        : controller.signal;

      try {
        const resp = await fetch(url, {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
          signal,
        });

        if (!resp.ok || !resp.body) {
          throw new SophiaApiError(`Stream error ${resp.status}`, resp.status);
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
              const trimmed = line.trim();
              if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.slice(6).trim();
              } else if (trimmed.startsWith('data:')) {
                try {
                  const data = JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
                  yield { event: currentEvent || 'message', data };
                  if (currentEvent === 'done' || currentEvent === 'timeout') return;
                } catch {
                  // Skip malformed data line
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }.bind(this) as (id: string, ro?: RequestOptions) => AsyncGenerator<MissionEvent>,

    /**
     * List user's missions with optional filters.
     */
    list: async (opts?: ListMissionsOptions, ro?: RequestOptions): Promise<PaginatedMissions> => {
      const params = new URLSearchParams();
      if (opts?.status) params.set('status', opts.status);
      if (opts?.command) params.set('command', opts.command);
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.cursor) params.set('cursor', opts.cursor);
      const qs = params.toString();
      return this.request<PaginatedMissions>(`/api/v1/missions${qs ? `?${qs}` : ''}`, {}, ro);
    },
  };

  /**
   * MCU Credits API
   */
  readonly credits = {
    /**
     * Get current MCU credit balance.
     */
    balance: async (ro?: RequestOptions): Promise<McuBalance> => {
      return this.request<McuBalance>('/api/v1/credits', {}, ro);
    },

    /**
     * Backwards-compatible alias for balance()
     */
    getBalance: async (ro?: RequestOptions): Promise<McuBalance> => {
      return this.credits.balance(ro);
    },

    /**
     * Atomically consume MCU credits.
     */
    consume: async (opts: ConsumeCreditsOptions, ro?: RequestOptions): Promise<ConsumeCreditsResult> => {
      return this.request<ConsumeCreditsResult>('/api/v1/credits/consume', {
        method: 'POST',
        body: JSON.stringify(opts),
      }, ro);
    },
  };

  /**
   * High-Level Algorithms API
   */
  readonly algorithms = {
    /** Enrich a video's description with the user's affiliate links */
    affiliateDescription: (videoId: string, opts: AffiliateDescriptionOptions = {}, ro: RequestOptions = {}): Promise<AffiliateDescription> => {
      const qp = new URLSearchParams();
      if (opts.niche) qp.set('niche', opts.niche);
      if (opts.max) qp.set('max', String(opts.max));
      const q = qp.toString();
      return this.request<AffiliateDescription>(`/api/videos/${videoId}/description-enriched${q ? `?${q}` : ''}`, {}, ro);
    },

    /** Translate text via BYOK OpenRouter key */
    translate: (input: TranslateInput, ro: RequestOptions = {}): Promise<TranslateResult> => {
      return this.request<TranslateResult>('/api/translate', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    /** Clone a voice via BYOK ElevenLabs key */
    cloneVoice: (input: VoiceCloneInput, ro: RequestOptions = {}): Promise<VoiceCloneResult> => {
      return this.request<VoiceCloneResult>('/api/voice/clone', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    /** Generate an SEO-scored script via BYOK OpenRouter key */
    seoScript: (input: SeoScriptInput, ro: RequestOptions = {}): Promise<SeoScriptResult> => {
      return this.request<SeoScriptResult>('/api/scripts/seo', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    /** Pull live homepage counters (public, no auth) */
    liveStats: (ro: RequestOptions = {}): Promise<LiveStats> => {
      return this.request<LiveStats>('/api/stats/live', {}, ro);
    },

    /** Schedule a video for auto-publish */
    schedulePublish: (input: PublishScheduleInput, ro: RequestOptions = {}): Promise<PublishScheduleResult> => {
      return this.request<PublishScheduleResult>('/api/publish/quick-schedule', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    /** Register a publishing channel (BYOK OAuth) */
    registerChannel: (input: RegisterChannelInput, ro: RequestOptions = {}): Promise<RegisterChannelResult> => {
      return this.request<RegisterChannelResult>('/api/publish/channels', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },
  };

  // ─── Direct Convenience Delegates ─────────────────────────────────────────

  /** Enrich video description (delegates to algorithms.affiliateDescription) */
  affiliateDescription(videoId: string, opts?: AffiliateDescriptionOptions, ro?: RequestOptions): Promise<AffiliateDescription> {
    return this.algorithms.affiliateDescription(videoId, opts, ro);
  }

  /** Translate text (delegates to algorithms.translate) */
  translate(input: TranslateInput, ro?: RequestOptions): Promise<TranslateResult> {
    return this.algorithms.translate(input, ro);
  }

  /** Clone a voice (delegates to algorithms.cloneVoice) */
  cloneVoice(input: VoiceCloneInput, ro?: RequestOptions): Promise<VoiceCloneResult> {
    return this.algorithms.cloneVoice(input, ro);
  }

  /** Generate SEO script (delegates to algorithms.seoScript) */
  seoScript(input: SeoScriptInput, ro?: RequestOptions): Promise<SeoScriptResult> {
    return this.algorithms.seoScript(input, ro);
  }

  /** Get live platform statistics (delegates to algorithms.liveStats) */
  liveStats(ro?: RequestOptions): Promise<LiveStats> {
    return this.algorithms.liveStats(ro);
  }

  /** Schedule video publication (delegates to algorithms.schedulePublish) */
  schedulePublish(input: PublishScheduleInput, ro?: RequestOptions): Promise<PublishScheduleResult> {
    return this.algorithms.schedulePublish(input, ro);
  }

  /** Register publishing channel (delegates to algorithms.registerChannel) */
  registerChannel(input: RegisterChannelInput, ro?: RequestOptions): Promise<RegisterChannelResult> {
    return this.algorithms.registerChannel(input, ro);
  }
}

export default SophiaClient;
