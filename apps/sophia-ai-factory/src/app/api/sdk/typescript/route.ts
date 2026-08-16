/**
 * GET /api/sdk/typescript
 *
 * Returns a single-file TypeScript SDK as `text/typescript`. The customer
 * can curl + paste this into their project and have type-safe wrappers
 * for all 8 algorithm endpoints in one file — the literal "5 lines of
 * code" promise from the homepage:
 *
 *   curl https://sophia.agencyos.network/api/sdk/typescript > sophia.ts
 *   import { SophiaClient } from "./sophia"
 *   const s = new SophiaClient(token)
 *   const { translated } = await s.translate({ text, fromLang, toLang })
 *
 * No auth required. Edge-cached 1 hour.
 *
 * @module app/api/sdk/typescript
 */
import { NextResponse } from 'next/server';

const SDK_SOURCE = `/**
 * Sophia AI Factory SDK — auto-generated single-file client.
 * Source of truth: https://sophia.agencyos.network/api/sdk/typescript
 */

export type SophiaToken = string;

interface RequestOptions {
  signal?: AbortSignal;
}

const DEFAULT_BASE = "https://sophia.agencyos.network";

async function call<T>(base: string, path: string, init: RequestInit, opts: RequestOptions): Promise<T> {
  const res = await fetch(base + path, { ...init, signal: opts.signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "<failed to read response body>");
    throw new Error(\`sophia[\${res.status}] \${path}: \${body.slice(0, 200)}\`);
  }
  return (await res.json()) as T;
}

export interface AffiliateDescription {
  description: string;
  affiliateCount: number;
}

export interface TranslateResult {
  translated: string;
  model: string;
}

export interface VoiceCloneResult {
  voiceId: string;
  samplesUploaded: number;
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

export interface PublishScheduleResult {
  jobId: string;
  scheduledAt: number;
  status: "scheduled";
}

export interface RegisterChannelResult {
  channelId: string;
  provider: string;
  status: "active";
}

export class SophiaClient {
  constructor(private token: SophiaToken, private base: string = DEFAULT_BASE) {}

  private h(): Record<string, string> {
    return { Authorization: \`Bearer \${this.token}\`, "Content-Type": "application/json" };
  }

  /** Cycle 1: enrich a video's description with the user's affiliate links. */
  affiliateDescription(videoId: string, opts: { niche?: string; max?: number } = {}, ro: RequestOptions = {}): Promise<AffiliateDescription> {
    const qp = new URLSearchParams();
    if (opts.niche) qp.set("niche", opts.niche);
    if (opts.max) qp.set("max", String(opts.max));
    const q = qp.toString();
    return call(this.base, \`/api/videos/\${videoId}/description-enriched\${q ? "?" + q : ""}\`, { headers: this.h() }, ro);
  }

  /** Cycle 2: translate text via BYOK OpenRouter key. */
  translate(input: { text: string; fromLang: string; toLang: string; tone?: "literal" | "natural" }, ro: RequestOptions = {}): Promise<TranslateResult> {
    return call(this.base, "/api/translate", { method: "POST", headers: this.h(), body: JSON.stringify(input) }, ro);
  }

  /** Cycle 3: clone a voice via BYOK ElevenLabs key. */
  cloneVoice(input: { name: string; audioUrls: string[]; description?: string }, ro: RequestOptions = {}): Promise<VoiceCloneResult> {
    return call(this.base, "/api/voice/clone", { method: "POST", headers: this.h(), body: JSON.stringify(input) }, ro);
  }

  /** Cycle 4: generate an SEO-scored script via BYOK OpenRouter key. */
  seoScript(input: { topic: string; keywords?: string[]; language?: "en" | "vi" }, ro: RequestOptions = {}): Promise<SeoScriptResult> {
    return call(this.base, "/api/scripts/seo", { method: "POST", headers: this.h(), body: JSON.stringify(input) }, ro);
  }

  /** Cycle 5: pull live homepage counters (public, no auth). */
  liveStats(ro: RequestOptions = {}): Promise<LiveStats> {
    return call(this.base, "/api/stats/live", {}, ro);
  }

  /** Cycle 6: schedule a video for auto-publish. */
  schedulePublish(input: { videoId: string; channelId: string; scheduledAt: number; caption?: string; hashtags?: string[] }, ro: RequestOptions = {}): Promise<PublishScheduleResult> {
    return call(this.base, "/api/publish/quick-schedule", { method: "POST", headers: this.h(), body: JSON.stringify(input) }, ro);
  }

  /** Cycle 7: register a publishing channel (BYOK OAuth). */
  registerChannel(input: { provider: "tiktok" | "youtube" | "instagram" | "facebook" | "twitter" | "linkedin" | "pinterest" | "threads" | "reddit" | "bluesky" | "mastodon" | "zalo" | "whatsapp"; externalAccountId: string; accessToken: string; refreshToken?: string }, ro: RequestOptions = {}): Promise<RegisterChannelResult> {
    return call(this.base, "/api/publish/channels", { method: "POST", headers: this.h(), body: JSON.stringify(input) }, ro);
  }
}

export default SophiaClient;
`;

export async function GET(): Promise<Response> {
  return new NextResponse(SDK_SOURCE, {
    status: 200,
    headers: {
      'Content-Type': 'text/typescript; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      'Content-Disposition': 'inline; filename="sophia.ts"',
    },
  });
}
