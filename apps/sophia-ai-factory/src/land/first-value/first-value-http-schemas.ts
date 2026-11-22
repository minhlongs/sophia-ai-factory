/**
 * Zod schemas and HTTP response helpers for /api/first-value (Track B1.1).
 *
 * @module land/first-value/first-value-http-schemas
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

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

export const FirstValuePostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cost_preview'),
    orgId: z.string().min(1).max(128),
    provider: z.string().min(1).max(64).nullable().optional(),
    model: z.string().min(1).max(128).nullable().optional(),
    topic: z.string().min(1).max(500).trim(),
    audience: z.string().min(1).max(300).trim(),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
  }),
  z.object({
    action: z.literal('fixture_preview'),
    orgId: z.string().min(1).max(128),
    topic: z.string().min(1).max(500).trim(),
    audience: z.string().min(1).max(300).trim(),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
  }),
  z.object({
    action: z.literal('create_review'),
    orgId: z.string().min(1).max(128),
    missionId: z.string().min(1).max(128).trim(),
    idempotencyKey: z.string().min(8).max(128).trim().optional(),
    topic: z.string().min(1).max(500).trim(),
    audience: z.string().min(1).max(300).trim(),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
    provenance: z.enum(['fixture_simulated', 'live_provider']).optional().default('fixture_simulated'),
    receipt: HonestReceiptSchema,
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
