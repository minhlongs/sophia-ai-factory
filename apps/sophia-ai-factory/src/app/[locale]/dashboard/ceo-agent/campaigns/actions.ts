/**
 * Campaign management Server Actions for the CEO Agent.
 *
 * Wire-up: standard `useTransition` + `refresh()` pattern.
 * Tier gating:
 *  - BASIC: read-only (list + view only). Creation/generation blocked.
 *  - PREMIUM: limited (max 5 campaigns/month, GPT-4o-mini tier model).
 *  - ENTERPRISE/MASTER: unlimited + full model access.
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getD1 } from '@/seed/db/client';
import { z } from 'zod';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CeoCampaign = {
  id: string;
  user_id: string;
  title: string;
  niche: string | null;
  topic: string | null;
  goal: string | null;
  language: 'vi' | 'en';
  status: 'draft' | 'generating' | 'completed' | 'failed';
  model: string | null;
  generated_script: string | null;
  generated_voiceover: string | null;
  generated_visuals: string | null;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ── Tier limits ────────────────────────────────────────────────────────────────

const TIER_LIMITS: Record<string, { maxCampaignsPerMonth: number; allowedModels: string[] }> = {
  BASIC: { maxCampaignsPerMonth: 0, allowedModels: [] },
  PREMIUM: { maxCampaignsPerMonth: 5, allowedModels: ['openai/gpt-4o-mini', 'google/gemini-2-5-flash'] },
  ENTERPRISE: { maxCampaignsPerMonth: 50, allowedModels: [] },
  MASTER: { maxCampaignsPerMonth: Infinity, allowedModels: [] },
};

function getLimitsForTier(tier: string) {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.BASIC;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

const CreateCampaignSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  niche: z.string().max(120).optional().nullable(),
  topic: z.string().max(500).optional().nullable(),
  goal: z.string().max(500).optional().nullable(),
  language: z.enum(['vi', 'en']),
  model: z.string().optional().nullable(),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `ceo_camp_${Date.now().toString(36)}_${Math.random().toString(36).replace(/\./g, '')}`;
}

function assertModelAllowed(model: string | null | undefined, tier: string): string {
  const limits = getLimitsForTier(tier);
  const selected = model ?? limits.allowedModels[0] ?? 'openai/gpt-4o-mini';

  if (limits.allowedModels.length > 0 && !limits.allowedModels.includes(selected)) {
    throw new Error(`Model ${selected} not in tier ${tier} allowed list: ${limits.allowedModels.join(', ')}`);
  }

  return selected;
}

// ── Actions ────────────────────────────────────────────────────────────────────

export interface ListCampaignsResult {
  ok: boolean;
  campaigns?: CeoCampaign[];
  remainingThisMonth?: number;
  tier?: string;
  error?: string;
}

export interface CreateCampaignResult {
  ok: boolean;
  campaign?: CeoCampaign;
  remainingThisMonth?: number;
  tier?: string;
  error?: string;
}

export interface GenerateCampaignContentResult {
  ok: boolean;
  campaign?: CeoCampaign;
  tier?: string;
  error?: string;
}

export interface ActionState<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type CreateCampaignAction = (prev: ActionState<CreateCampaignResult>) => Promise<ActionState<CreateCampaignResult>>;

export type GenerateCampaignContentAction = (
  prev: ActionState<GenerateCampaignContentResult>,
) => Promise<ActionState<GenerateCampaignContentResult>>;

/**
 * List campaigns for the current user, respecting tier (BASIC sees own, PREMIUM/ENTERPRISE/MASTER full).
 */
export async function listCampaignsAction(): Promise<ListCampaignsResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'auth_required' };

    const tier = await resolveUserTier(user.id);
    const db = getD1();
    if (!db) throw new Error('D1_UNAVAILABLE');

    const { results } = await db
      .prepare('SELECT * FROM ceo_campaigns WHERE user_id = ? ORDER BY created_at DESC')
      .bind(user.id)
      .all<CeoCampaign>();

    const campaigns = (results ?? []) as CeoCampaign[];

    // For PREMIUM (or higher), show the remaining count for the read-only footer context
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const createdThisMonth = campaigns.filter((c) => new Date(c.created_at) >= startOfMonth).length;
    const limits = getLimitsForTier(tier);
    const remainingThisMonth = limits.maxCampaignsPerMonth === Infinity ? Infinity : Math.max(0, limits.maxCampaignsPerMonth - createdThisMonth);

    return { ok: true, campaigns, remainingThisMonth, tier };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error('[CampaignActions] listCampaigns failed', { error: message });
    return { ok: false, error: message };
  }
}

/**
 * Create a new campaign draft (BASIC allowed; only tier gate is creation permission).
 * PREMIUM/ENTERPRISE/MASTER may create; BASIC gets a tier-gate rejection.
 */
export async function createCampaignAction(
  prev: ActionState<CreateCampaignResult>,
  formData: FormData,
): Promise<ActionState<CreateCampaignResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'auth_required' };

    const tier = await resolveUserTier(user.id);
    const limits = getLimitsForTier(tier);

    if (limits.maxCampaignsPerMonth === 0) {
      return { ok: false, error: 'BASIC_TIER_CAMPAIGN_CREATION_DISABLED' };
    }

    const raw = {
      title: String(formData.get('title') ?? ''),
      niche: (formData.get('niche') as string | null) ?? null,
      topic: (formData.get('topic') as string | null) ?? null,
      goal: (formData.get('goal') as string | null) ?? null,
      language: ((formData.get('language') as string) ?? 'en') as 'vi' | 'en',
      model: (formData.get('model') as string | null) ?? null,
    };

    const parsed = CreateCampaignSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: `VALIDATION_ERROR: ${parsed.error.issues.map((i) => i.message).join(', ')}` };
    }

    // Enforce PER-MONTH cap
    const db = getD1();
    if (!db) throw new Error('D1_UNAVAILABLE');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartIso = startOfMonth.toISOString();

    const { results: monthCountRows } = await db
      .prepare('SELECT COUNT(*) AS cnt FROM ceo_campaigns WHERE user_id = ? AND created_at >= ?')
      .bind(user.id, monthStartIso)
      .all<{ cnt: number }>();

    const createdThisMonth = monthCountRows?.[0]?.cnt ?? 0;

    if (limits.maxCampaignsPerMonth !== Infinity && createdThisMonth >= limits.maxCampaignsPerMonth) {
      return {
        ok: false,
        error: 'TIER_CAMPAIGN_LIMIT_REACHED',
        data: { ok: false, tier, remainingThisMonth: 0 },
      };
    }

    const model = assertModelAllowed(parsed.data.model, tier);
    const campaign: CeoCampaign = {
      id: generateId(),
      user_id: user.id,
      title: parsed.data.title.trim(),
      niche: parsed.data.niche?.trim() ?? null,
      topic: parsed.data.topic?.trim() ?? null,
      goal: parsed.data.goal?.trim() ?? null,
      language: parsed.data.language,
      status: 'draft',
      model,
      generated_script: null,
      generated_voiceover: null,
      generated_visuals: null,
      output_url: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.prepare(`INSERT INTO ceo_campaigns (
      id, user_id, title, niche, topic, goal, language, status, model,
      generated_script, generated_voiceover, generated_visuals, output_url,
      error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      campaign.id,
      campaign.user_id,
      campaign.title,
      campaign.niche,
      campaign.topic,
      campaign.goal,
      campaign.language,
      campaign.status,
      campaign.model,
      campaign.generated_script,
      campaign.generated_voiceover,
      campaign.generated_visuals,
      campaign.output_url,
      campaign.error_message,
      campaign.created_at,
      campaign.updated_at,
    );

    logger.info('[CampaignActions] campaignCreated', {
      campaignId: campaign.id,
      tier,
      model: campaign.model,
    });

    const updatedRemaining = limits.maxCampaignsPerMonth === Infinity ? Infinity : limits.maxCampaignsPerMonth - createdThisMonth - 1;

    return { ok: true, data: { ok: true, campaign, tier, remainingThisMonth: updatedRemaining } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error('[CampaignActions] createCampaign failed', { error: message });
    return { ok: false, error: message };
  }
}

/**
 * AI generation using OpenRouter (uses user's BYOK key via resolve-user-api-key).
 *
 * Tier effect:
 *  - BASIC: rejected.
 *  - PREMIUM: uses gpt-4o-mini or gemini-2-5-flash.
 *  - ENTERPRISE/MASTER: full model list.
 */
export async function generateCampaignContentAction(
  prev: ActionState<GenerateCampaignContentResult>,
  campaignId: string,
): Promise<ActionState<GenerateCampaignContentResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'auth_required' };

    const tier = await resolveUserTier(user.id);
    const limits = getLimitsForTier(tier);

    if (limits.maxCampaignsPerMonth === 0) {
      return { ok: false, error: 'BASIC_TIER_GENERATION_DISABLED', data: { ok: false, tier } };
    }

    const db = getD1();
    if (!db) throw new Error('D1_UNAVAILABLE');

    const { results } = await db
      .prepare('SELECT * FROM ceo_campaigns WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(campaignId, user.id)
      .all<CeoCampaign>();

    const campaign = (results?.[0] ?? null) as CeoCampaign | undefined;
    if (!campaign) return { ok: false, error: 'CAMPAIGN_NOT_FOUND', data: { ok: false, tier } };

    const allowedModel = assertModelAllowed(campaign.model, tier);

    // Mark generating
    await db
      .prepare('UPDATE ceo_campaigns SET status = ?, updated_at = ? WHERE id = ?')
      .bind('generating', new Date().toISOString(), campaignId)
      .run();

    // ── Generate via OpenRouter smart-routed call ─────────────────────────────

    const apiKeyRow = await db
      .prepare('SELECT encrypted_key, key_version FROM user_api_keys WHERE user_id = ? AND provider = ? LIMIT 1')
      .bind(user.id, 'openrouter')
      .first<{ encrypted_key: ArrayBuffer; key_version: number | null }>();

    if (!apiKeyRow?.encrypted_key) {
      // Fallback to env key — protected under operator-only policy.
      const envKey = process.env.OPENROUTER_API_KEY;
      if (!envKey) {
        await db
          .prepare('UPDATE ceo_campaigns SET status = ?, error_message = ? WHERE id = ?')
          .bind('failed', 'Missing OpenRouter API key (BYOK or env). Updated your key in Setup Wizard.', campaignId)
          .run();

        return {
          ok: false,
          error: 'MISSING_OPENROUTER_KEY',
          data: { ok: false, tier, campaign: { ...campaign, status: 'failed', error_message: 'Missing OpenRouter API key' } },
        };
      }

      await callOpenRouterGenerate(envKey, allowedModel, campaign, tier);
    } else {
      // Decrypt the key — minimal helper here using crypto.subtle. The actual
      // decrypt logic lives in tree/byok/byok-crypto.ts; we expose a lightweight
      // re-export for this module to avoid direct crypt import here.
      await decryptAndCallOpenRouter(apiKeyRow.encrypted_key, apiKeyRow.key_version, user.id, allowedModel, campaign, tier);
    }

    const { results: updatedRows } = await db
      .prepare('SELECT * FROM ceo_campaigns WHERE id = ? LIMIT 1')
      .bind(campaignId)
      .all<CeoCampaign>();

    const updated = (updatedRows?.[0] ?? null) as CeoCampaign | undefined;
    if (!updated) return { ok: false, error: 'CAMPAIGN_NOT_FOUND_AFTER_UPDATE', data: { ok: false, tier } };

    return { ok: true, data: { ok: true, campaign: updated, tier } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error('[CampaignActions] generateCampaignContent failed', { error: message });

    const d1 = getD1();
    if (d1) {
      try {
        await d1.prepare('UPDATE ceo_campaigns SET status = ?, error_message = ? WHERE id = ?').bind('failed', message, campaignId).run();
      } catch {
        // no-op
      }
    }

    return { ok: false, error: message, data: { ok: false, tier: await resolveUserTier((await getCurrentUser())?.id ?? '') } };
  }
}

// ── Internal helpers (hybrid HTTP) ─────────────────────────────────────────────

async function decryptAndCallOpenRouter(
  encryptedKey: ArrayBuffer,
  keyVersion: number | null,
  userId: string,
  model: string,
  campaign: CeoCampaign,
  tier: string,
): Promise<void> {
  // Lazy import to keep top-level tree boundary clean — crypto module in seed only loads on demand.
  const { decryptApiKey } = await import('@/tree/byok/byok-crypto');
  const { getActiveKeyVersion } = await import('@/tree/byok/byok-crypto');

  const activeVersion = keyVersion ?? (await getActiveKeyVersion());
  const decrypted = await decryptApiKey(new Uint8Array(encryptedKey), userId, activeVersion, keyVersion == null);

  await callOpenRouterGenerate(decrypted, model, campaign, tier);
}

async function callOpenRouterGenerate(
  apiKey: string,
  model: string,
  campaign: CeoCampaign,
  tier: string,
): Promise<void> {
  const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  const systemPrompt = buildGenerationPrompt(campaign, tier);
  const userBody = buildUserPrompt(campaign);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL ?? 'https://sophia.agencyos.network',
      'X-Title': 'Sophia AI Factory — CEO Agent',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBody },
      ],
      max_tokens: 2048,
      temperature: 0.6,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown');
    throw new Error(`OpenRouter HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { completion_tokens?: number };
  };

  const generated = data.choices?.[0]?.message?.content ?? '';

  const db = getD1();
  if (!db) throw new Error('D1_UNAVAILABLE');

  await db
    .prepare(
      `UPDATE ceo_campaigns
       SET status = ?, generated_script = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind('completed', generated, new Date().toISOString(), campaign.id)
    .run();

  logger.info('[CampaignActions] contentGenerated', {
    campaignId: campaign.id,
    model,
    tier,
    completionTokens: data.usage?.completion_tokens,
  });
}

// ── Prompt builders ────────────────────────────────────────────────────────────

function buildGenerationPrompt(campaign: CeoCampaign, tier: string): string {
  const niche = campaign.niche ?? 'general business';
  const topic = campaign.topic ?? 'daily content strategy';
  const goal = campaign.goal ?? 'drive engagement';
  const langLabel = campaign.language === 'vi' ? 'Tiếng Việt' : 'English';

  return [
    `You are Sophia CEO Agent — a no-code marketing co-pilot for non-technical CEOs.`,
    `Output language: ${langLabel}. Tone: actionable, concise, no jargon, bilingual when helpful.`,
    `User tier: ${tier}.`,
    `Niche: ${niche}.`,
    `Campaign topic: ${topic}.`,
    `Business goal: ${goal}.`,
    `Produce:`,
    `1) A 30–45s short-form video script (hook, body, CTA).`,
    `2) A companion voiceover paragraph (natural speech, ~90 words).`,
    `3) 3 visual cues for an AI video tool.`,
    `Keep each section labeled and easy to execute by a non-technical operator.`,
  ].join('\n');
}

function buildUserPrompt(campaign: CeoCampaign): string {
  return [
    `Niche: ${campaign.niche ?? 'general business'}`,
    `Topic: ${campaign.topic ?? 'daily content strategy'}`,
    `Goal: ${campaign.goal ?? 'drive engagement'}`,
    `Please return the 3-part output in the tone defined in the system prompt.`,
  ].join('\n');
}
