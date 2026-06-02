/**
 * OpenClaw Bridge — in-process Telegram → Sophia API surface.
 *
 * Mirrors the 7 tools exposed by the @longtho/openclaw-sophia plugin so the
 * Telegram bot can run the full OpenClaw contract without going through HTTP
 * loopback (CF Worker subrequest cost) or requiring an OpenClaw runtime to be
 * deployed alongside Sophia.
 *
 * Contract parity with sophia-openclaw-plugin/src/tools/*:
 *   sophia_get_version       → callGetVersion()
 *   sophia_get_tier          → callGetTier(userId)
 *   sophia_get_quota         → callGetQuota(userId)
 *   sophia_get_affiliate_stats → callGetAffiliateStats(userId, limit, offset)
 *   sophia_get_video_status  → callGetVideoStatus(userId, statusFilter?, limit?)
 *   sophia_get_handover      → callGetHandover(userId)
 *   sophia_redeem_free100    → callRedeemFree100(input)
 *
 * Why direct service calls instead of HTTP loopback:
 *   - CF Workers subrequest cost (each self-fetch counts against limits).
 *   - In-process avoids re-serializing JSON twice.
 *   - Lets the bridge run inside a single Telegram webhook invocation cleanly.
 *
 * @module tree/telegram/openclaw-bridge
 */
import { createServerClient, getD1Raw } from '@/seed/db/client';
import { getQuotaStatus } from '@/forest/quota/quota-checker-overage';
import { QUOTA_LIMITS } from '@/forest/usage-metering/aggregator';
import type { QuotaLimit } from '@/forest/usage-metering/types';
import type { CachedQuota } from '@/forest/quota/quota-checker-types';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { applyPromoCode } from '@/land/promo/promo-applier';
import { validatePromoCode } from '@/land/promo/promo-validator';
import {
  buildVideoDescription,
  type VideoDescriptionResult,
} from '@/land/affiliates/video-description-injector';
import {
  translateScript,
  TranslateConfigurationError,
  type TranslateScriptResult,
} from '@/land/i18n/translate-script';
import {
  cloneVoice,
  VoiceCloneConfigurationError,
  type CloneVoiceResult,
} from '@/land/voice/clone-voice';
import {
  generateSeoScript,
  SeoScriptConfigurationError,
  type GenerateSeoScriptResult,
} from '@/land/scripts/generate-seo-script';
import {
  schedulePublish,
  PublishConfigurationError,
  type SchedulePublishResult,
} from '@/land/publish/schedule-video-publish';
import { createCustomerUser } from '@/tree/handover/handover-account-setup';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { CustomerHandoverRow } from '@/tree/handover/handover-types';

// ─── Chat → User resolver ────────────────────────────────────────────────────

/**
 * Resolve the Sophia user_id paired to a given Telegram chat_id.
 * Returns null when the chat has not been paired yet.
 */
export async function resolveUserIdFromChat(chatId: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('telegram_paired_chats')
      .select('paired_by')
      .eq('chat_id', chatId)
      .limit(1)
      .single() as { data: { paired_by: string | null } | null };
    return data?.paired_by ?? null;
  } catch (err) {
    logger.warn('[openclaw-bridge] resolveUserIdFromChat failed', toError(err));
    return null;
  }
}

// ─── 1. sophia_get_version ───────────────────────────────────────────────────

export interface VersionInfo {
  shortSha: string;
  deployedAt: string;
}

export function callGetVersion(): VersionInfo {
  const sha = process.env.COMMIT_SHA ?? 'unknown';
  return {
    shortSha: sha === 'unknown' ? 'unknown' : sha.slice(0, 8),
    deployedAt: process.env.DEPLOYED_AT ?? 'unknown',
  };
}

// ─── 2. sophia_get_tier ──────────────────────────────────────────────────────

export interface TierInfo {
  email: string;
  displayName: string;
  tier: string;
  locale: string;
}

export async function callGetTier(userId: string): Promise<TierInfo | null> {
  const db = createServerClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('settings')
    .eq('user_id', userId)
    .single() as { data: { settings: string | null } | null };

  let settings: Record<string, unknown> = {};
  try {
    if (profile?.settings) settings = JSON.parse(profile.settings) as Record<string, unknown>;
  } catch {
    // malformed JSON — leave empty
  }

  const { data: userRow } = await db
    .from('user')
    .select('email, name')
    .eq('id', userId)
    .single() as { data: { email: string; name: string | null } | null };

  if (!userRow) return null;

  // License row drives current tier (matches /api/quota/status logic).
  const { data: license } = await db
    .from('raas_licenses')
    .select('tier')
    .eq('created_by', userId)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: { tier: string | null } | null };

  return {
    email: userRow.email,
    displayName: (settings.display_name as string) ?? userRow.name ?? '',
    tier: (license?.tier ?? 'BASIC').toUpperCase(),
    locale: (settings.locale as string) ?? 'en',
  };
}

// ─── 3. sophia_get_quota ─────────────────────────────────────────────────────

export interface QuotaInfo {
  tier: string;
  usage: CachedQuota;
  limits: QuotaLimit;
  percentages: { hourly: number; daily: number; monthly: number };
  status: string;
}

const EMPTY_USAGE: CachedQuota = {
  hourly: 0,
  daily: 0,
  monthly: 0,
  requests: 0,
};

export async function callGetQuota(userId: string): Promise<QuotaInfo> {
  const db = createServerClient();
  const { data: license } = await db
    .from('raas_licenses')
    .select('nonce, tier')
    .eq('created_by', userId)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: { nonce: string; tier: string | null } | null };

  if (!license) {
    return {
      tier: 'BASIC',
      usage: { ...EMPTY_USAGE },
      limits: QUOTA_LIMITS.BASIC,
      percentages: { hourly: 0, daily: 0, monthly: 0 },
      status: 'ok',
    };
  }

  const tier = (license.tier ?? 'BASIC').toUpperCase();
  const status = await getQuotaStatus(userId, license.nonce, tier);
  return { tier, ...status };
}

// ─── 4. sophia_get_affiliate_stats ───────────────────────────────────────────

export interface AffiliateStats {
  count: number;
  conversions: Awaited<ReturnType<typeof getRecentConversions>>;
}

export async function callGetAffiliateStats(
  userId: string,
  limit = 5,
  offset = 0,
): Promise<AffiliateStats> {
  try {
    const conversions = await getRecentConversions(userId, userId, limit, offset);
    return { count: conversions.length, conversions };
  } catch (err) {
    logger.warn('[openclaw-bridge] affiliate stats failed', toError(err), { userId });
    return { count: 0, conversions: [] };
  }
}

// ─── 5. sophia_get_video_status ──────────────────────────────────────────────

export interface VideoSummary {
  id: string;
  title: string | null;
  status: string;
  created_at: number;
  duration_sec: number | null;
}

export async function callGetVideoStatus(
  userId: string,
  statusFilter?: string,
  limit = 10,
): Promise<{ count: number; videos: VideoSummary[] }> {
  const db = createServerClient();
  let query = db
    .from('videos')
    .select('id, title, status, duration_sec, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (statusFilter && ['processing', 'completed', 'failed'].includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }
  const { data } = await query as { data: VideoSummary[] | null };
  const videos = data ?? [];
  return { count: videos.length, videos };
}

// ─── 6. sophia_get_handover ──────────────────────────────────────────────────

export interface HandoverSummary {
  handoverId: string;
  agencyName: string | null;
  tier: string | null;
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
  status: string | null;
}

export async function callGetHandover(userId: string): Promise<HandoverSummary | null> {
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(
        `SELECT id, agency_name, tier, customer_first_login_at,
                customer_first_sop_install_at, customer_first_run_at, status
         FROM customer_handovers
         WHERE customer_user_id = ?1
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(userId)
      .first<Pick<
        CustomerHandoverRow,
        'id' | 'agency_name' | 'tier' | 'customer_first_login_at'
        | 'customer_first_sop_install_at' | 'customer_first_run_at' | 'status'
      >>();
    if (!row) return null;
    return {
      handoverId: row.id,
      agencyName: row.agency_name,
      tier: row.tier,
      firstLoginAt: row.customer_first_login_at,
      firstSopInstallAt: row.customer_first_sop_install_at,
      firstRunAt: row.customer_first_run_at,
      status: row.status,
    };
  } catch (err) {
    logger.warn('[openclaw-bridge] handover query failed', toError(err), { userId });
    return null;
  }
}

// ─── 7. sophia_embed_affiliate (homepage promise algorithm) ──────────────────
//
// Delivers the "Affiliate Program Discovery — manage your affiliate IDs to
// embed into video descriptions" promise. Pure composition of the user's
// affiliate_links + a base body (auto-loaded from videos.title when a videoId
// is supplied).

export interface EmbedAffiliateInput {
  userId: string;
  videoId?: string;
  baseBody?: string;
  nicheHint?: string;
  maxLinks?: number;
}

export async function callEmbedAffiliateInDescription(
  input: EmbedAffiliateInput,
): Promise<VideoDescriptionResult> {
  let body = input.baseBody ?? '';
  if (input.videoId) {
    try {
      const db = createServerClient();
      const { data: video } = await db
        .from('videos')
        .select('title, user_id')
        .eq('id', input.videoId)
        .maybeSingle() as { data: { title: string | null; user_id: string } | null };
      if (video && video.user_id === input.userId && video.title) {
        body = video.title;
      }
    } catch (err) {
      logger.warn('[openclaw-bridge] video lookup failed', toError(err), { videoId: input.videoId });
    }
  }
  return buildVideoDescription({
    userId: input.userId,
    baseBody: body,
    nicheHint: input.nicheHint,
    maxLinks: input.maxLinks,
  });
}

// ─── 8. sophia_translate_script (homepage promise: global reach via BYOK) ────

export interface TranslateBridgeInput {
  userId: string;
  text: string;
  fromLang: string;
  toLang: string;
  tone?: 'literal' | 'natural';
}

export interface TranslateBridgeResult {
  ok: true;
  result: TranslateScriptResult;
}

export interface TranslateBridgeError {
  ok: false;
  code: 'BYOK_REQUIRED' | 'EMPTY_TEXT' | 'UPSTREAM_FAILED';
  message: string;
}

export async function callTranslateScript(
  input: TranslateBridgeInput,
): Promise<TranslateBridgeResult | TranslateBridgeError> {
  try {
    const result = await translateScript(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof TranslateConfigurationError) {
      return { ok: false, code: err.code === 'EMPTY_TEXT' ? 'EMPTY_TEXT' : 'BYOK_REQUIRED', message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
  }
}

// ─── 9. sophia_clone_voice (homepage promise: ElevenLabs voice via BYOK) ─────

export interface CloneVoiceBridgeInput {
  userId: string;
  name: string;
  audioUrls: string[];
  description?: string;
}

export type CloneVoiceBridgeResult =
  | { ok: true; result: CloneVoiceResult }
  | { ok: false; code: 'BYOK_REQUIRED' | 'EMPTY_AUDIO' | 'NAME_INVALID' | 'TOO_MANY_SAMPLES' | 'SAMPLE_TOO_LARGE' | 'UPSTREAM_FAILED'; message: string };

export async function callCloneVoice(input: CloneVoiceBridgeInput): Promise<CloneVoiceBridgeResult> {
  try {
    const result = await cloneVoice(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof VoiceCloneConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
  }
}

// ─── 10. sophia_generate_seo_script (homepage promise: AI script + SEO) ──────

export interface SeoScriptBridgeInput {
  userId: string;
  topic: string;
  keywords?: string[];
  language?: 'en' | 'vi';
}

export type SeoScriptBridgeResult =
  | { ok: true; result: GenerateSeoScriptResult }
  | { ok: false; code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC' | 'UPSTREAM_FAILED'; message: string };

export async function callGenerateSeoScript(input: SeoScriptBridgeInput): Promise<SeoScriptBridgeResult> {
  try {
    const result = await generateSeoScript(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof SeoScriptConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
  }
}

// ─── 11. sophia_schedule_publish (homepage promise: 24/7 auto-publish) ───────

export interface SchedulePublishBridgeInput {
  userId: string;
  videoId: string;
  channelId: string;
  scheduledAt: number;
  caption?: string;
  hashtags?: string[];
}

export type SchedulePublishBridgeResult =
  | { ok: true; result: SchedulePublishResult }
  | { ok: false; code: PublishConfigurationError['code'] | 'UPSTREAM_FAILED'; message: string };

export async function callSchedulePublish(
  input: SchedulePublishBridgeInput,
): Promise<SchedulePublishBridgeResult> {
  try {
    const result = await schedulePublish(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof PublishConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
  }
}

// ─── 12. sophia_redeem_free100 ───────────────────────────────────────────────

export interface RedeemFree100Input {
  code: string;
  email: string;
  fullName?: string;
  tier?: string;
  locale?: string;
}

export interface RedeemFree100Result {
  success: boolean;
  magicLink?: string;
  handoverId?: string;
  error?: string;
}

export async function callRedeemFree100(input: RedeemFree100Input): Promise<RedeemFree100Result> {
  try {
    const preCheck = await validatePromoCode(input.code, { tier: input.tier });
    if (!preCheck.valid) {
      return { success: false, error: preCheck.reason ?? 'invalid_code' };
    }
    if (preCheck.discountType !== 'free_trial' && preCheck.discountType !== 'free_full') {
      return { success: false, error: 'Code requires payment' };
    }

    const db = await getD1Raw();
    let userId: string | null = null;
    try {
      const existing = await db
        .prepare('SELECT id FROM user WHERE email = ?1 LIMIT 1')
        .bind(input.email)
        .first<{ id: string }>();
      userId = existing?.id ?? null;
    } catch {
      // continue to auto-create path
    }

    if (!userId) {
      const resolvedName = input.fullName?.trim() || input.email.split('@')[0];
      userId = await createCustomerUser(db, input.email, resolvedName);
    }

    const result = await applyPromoCode({
      code: input.code,
      userId,
      email: input.email,
      fullName: input.fullName,
      tier: input.tier ?? preCheck.appliesToTier ?? 'MASTER',
      locale: input.locale ?? 'vi',
    });

    return {
      success: true,
      magicLink: result.magicLink ?? undefined,
      handoverId: result.handoverId ?? undefined,
    };
  } catch (err) {
    logger.error('[openclaw-bridge] redeem-free failed', err instanceof Error ? err : undefined);
    return { success: false, error: err instanceof Error ? err.message : 'redeem_failed' };
  }
}
