/**
 * Zod schemas and HTTP response helpers for /api/first-value (Track B1.1).
 *
 * @module land/first-value/first-value-http-schemas
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PilotAffiliateStudioActionSchemas } from './pilot-affiliate-studio-schemas';

export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const;

const BudgetVerdictSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('within_budget'), remainingUsd: z.number().nullable() }),
  z.object({ outcome: z.literal('no_cap_set') }),
  z.object({ outcome: z.literal('budget_exhausted'), remainingUsd: z.number() }),
  z.object({ outcome: z.literal('cooldown_active'), resumesAtUnix: z.number() }),
]);

export const HonestReceiptSchema = z.object({
  receiptId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
  orgId: z.string().min(1).max(128),
  provider: z.string().min(1).max(64),
  maskedKey: z.string().min(1).max(64),
  checkedAtUnix: z.number().int().positive(),
  capabilities: z.array(z.string().min(1).max(64)),
  budget: z.object({
    monthlyBudgetUsd: z.number().nullable(),
    monthSpentUsd: z.number(),
    cooldownUntil: z.number().nullable(),
  }),
  verdict: BudgetVerdictSchema,
  policyStatus: z.enum(['found', 'absent', 'unreadable']).optional(),
  keyFormatAccepted: z.boolean(),
  keyStoredSecurely: z.boolean(),
  providerAuthStatus: z.enum(['verified', 'untested', 'rejected', 'unreachable']),
  capabilitiesKnown: z.enum(['probed', 'inferred_from_provider_table', 'unknown']),
  costBasis: z.enum(['estimated', 'actual', 'unavailable']),
  paidInferenceExecuted: z.literal(false),
  receiptIntegrity: z.object({
    algorithm: z.literal('hmac-sha256'),
    signature: z.string().min(16).max(128),
  }),
});

const EditableSceneSchema = z.object({
  scene_number: z.number().int().min(1).max(30),
  title: z.string().trim().min(1).max(200).optional(),
  visual_description: z.string().trim().min(1).max(1500),
  narration: z.string().trim().min(1).max(2000),
  duration_estimate: z.number().min(1).max(120),
});

const EditableScriptSchema = z.object({
  title: z.string().trim().min(1).max(300),
  total_duration: z.number().min(3).max(600),
  scenes: z.array(EditableSceneSchema).min(3).max(20),
});

export const FirstValuePostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cost_preview'),
    orgId: z.string().min(1).max(128),
    provider: z.string().min(1).max(64).nullable().optional(),
    model: z.string().min(1).max(128).nullable().optional(),
    topic: z.string().trim().min(1).max(500),
    audience: z.string().trim().min(1).max(300),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
  }),
  z.object({
    action: z.literal('fixture_preview'),
    orgId: z.string().min(1).max(128),
    topic: z.string().trim().min(1).max(500),
    audience: z.string().trim().min(1).max(300),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
  }),
  z.object({
    action: z.literal('create_review'),
    orgId: z.string().min(1).max(128),
    missionId: z.string().trim().min(1).max(128),
    idempotencyKey: z.string().min(8).max(128).trim().optional(),
    topic: z.string().trim().min(1).max(500),
    audience: z.string().trim().min(1).max(300),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
    provenance: z.enum(['fixture_simulated', 'live_provider']).optional().default('fixture_simulated'),
    receipt: HonestReceiptSchema.optional(),
  }),
  z.object({
    action: z.literal('edit_review'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
    expectedVersion: z.number().int().min(1),
    script: EditableScriptSchema,
    idempotencyKey: z.string().min(8).max(128).trim().optional(),
  }),
  z.object({
    action: z.literal('accept_pilot_terms'),
    orgId: z.string().min(1).max(128),
    policyVersion: z.string().trim().min(1).max(64),
    accepted: z.literal(true),
  }),
  z.object({
    action: z.literal('submit_feedback'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128).optional().nullable(),
    rating: z.number().int().min(1).max(5),
    category: z.enum(['usefulness', 'editing_friction', 'bug_report', 'other']),
    comment: z.string().trim().min(1).max(2000),
    screenshotDataUrl: z
      .string()
      .max(700_000)
      .regex(
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
        'Screenshot must be a PNG, JPEG, or WebP image (max 500KB)',
      )
      .optional()
      .nullable(),
  }),
  z.object({
    action: z.literal('save_byok_key'),
    orgId: z.string().min(1).max(128),
    provider: z.enum(['openrouter', 'heygen']).optional().default('openrouter'),
    apiKey: z.string().trim().min(12).max(256),
  }),
  z.object({
    action: z.literal('clear_byok_key'),
    orgId: z.string().min(1).max(128),
    provider: z.enum(['openrouter', 'heygen']).optional().default('openrouter'),
  }),
  z.object({
    action: z.literal('create_affiliate_shortlink'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128).optional().nullable(),
    destinationUrl: z.string().trim().min(10).max(2000),
    ctaText: z.string().trim().min(3).max(240),
    networkHint: z
      .enum(['generic', 'shopee', 'tiktok_shop', 'accesstrade', 'clickbank', 'amazon', 'awin'])
      .optional()
      .default('generic'),
    disclosureTag: z.enum(['#QuảngCáo', '#ad']).optional().default('#QuảngCáo'),
  }),
  z.object({
    action: z.literal('record_mp4_export'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
    sha256Hex: z.string().regex(/^[a-f0-9]{64}$/i),
    byteSize: z.number().int().min(128).max(268_435_456),
    durationSec: z.number().min(1).max(600),
    width: z.number().int().min(160).max(3840),
    height: z.number().int().min(160).max(3840),
    codec: z.literal('h264').optional().default('h264'),
    containerBrand: z.enum(['isom', 'mp42', 'mp41', 'avc1']).optional().default('isom'),
    ctaText: z.string().trim().min(3).max(240),
    shortCode: z.string().regex(/^[a-z2-7]{8,13}$/),
    referralUrl: z.string().trim().min(10).max(2000),
  }),
  z.object({
    action: z.literal('submit_heygen_mp4'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
    ctaText: z.string().trim().min(3).max(240),
    shortCode: z.string().regex(/^[a-z2-7]{8,13}$/),
    referralUrl: z.string().trim().min(10).max(2000),
  }),
  z.object({
    action: z.literal('poll_heygen_mp4'),
    orgId: z.string().min(1).max(128),
    exportId: z.string().min(4).max(128),
  }),
  z.object({
    action: z.literal('record_manual_publish'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128).optional().nullable(),
    mp4ExportId: z.string().min(1).max(128).optional().nullable(),
    linkId: z.string().min(1).max(128).optional().nullable(),
    platform: z.enum(['tiktok', 'youtube_shorts', 'instagram_reels', 'facebook_reels', 'other']),
    publishedPostUrl: z.string().trim().min(10).max(2000),
    reportedViews: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
    reportedConversions: z.number().int().min(0).max(1_000_000).optional().nullable(),
    reportedCommissionAmount: z.number().min(0).max(100_000_000_000).optional().nullable(),
    reportedCommissionCurrency: z
      .enum(['VND', 'USD', 'USDT'])
      .optional()
      .nullable(),
    evidenceNote: z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({
    action: z.literal('submit_support_request'),
    orgId: z.string().min(1).max(128),
    requestType: z.enum(['support', 'data_deletion']),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(5).max(2000),
  }),
  z.object({
    action: z.literal('get_review'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal('accept_review'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
    expectedVersion: z.number().int().min(1),
    explicitUserAction: z.literal(true),
    idempotencyKey: z.string().min(8).max(128).trim().optional(),
  }),
  z.object({
    action: z.literal('reject_review'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
    expectedVersion: z.number().int().min(1),
    explicitUserAction: z.literal(true),
    reason: z.string().max(500).trim().optional(),
    idempotencyKey: z.string().min(8).max(128).trim().optional(),
  }),
  z.object({
    action: z.literal('private_export'),
    orgId: z.string().min(1).max(128),
    artifactId: z.string().min(1).max(128),
    format: z.enum(['json', 'markdown']).default('json'),
    idempotencyKey: z.string().min(8).max(128).trim().optional(),
  }),
  ...PilotAffiliateStudioActionSchemas,
]);

export type FirstValuePostPayload = z.infer<typeof FirstValuePostSchema>;

export function jsonPrivate(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export function resolveIdempotencyKey(
  headerValue: string | null,
  bodyValue: string | undefined,
): { ok: true; key: string } | { ok: false; error: string } {
  const hdr = headerValue?.trim() ?? '';
  const body = bodyValue?.trim() ?? '';
  if (hdr && body && hdr !== body) {
    return { ok: false, error: 'Conflicting Idempotency-Key header and body value' };
  }
  const key = hdr || body;
  if (key.length < 8 || key.length > 128) {
    return { ok: false, error: 'Valid idempotencyKey (8-128 chars) is required' };
  }
  return { ok: true, key };
}
