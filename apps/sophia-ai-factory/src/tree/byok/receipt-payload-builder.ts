/**
 * Builds the receipt fields a BYOK validation response carries.
 *
 * The Setup Wizard shows what a key can do and what it has left to spend, so a
 * customer learns before a run fails that their key cannot make tool calls or
 * has hit its monthly budget. Kept separate from the route so the same payload
 * serves the API route and the server action that stores the key.
 *
 * A read that fails is not a refusal: the payload still reports capabilities
 * from the provider table and an absent cap, because a budget read failure must
 * not read as an exhausted budget and needlessly block a working key.
 *
 * @module tree/byok/receipt-payload-builder
 */

import { getD1 } from '@/seed/db/client';
import { getUserWorkspaceIds } from '@/seed/auth/workspace-access';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { buildValidationReceipt } from '@/tree/byok/key-capability-gate';
import type {
  KeyBudgetState,
  KeyCapability,
  ValidationReceipt,
} from '@/tree/byok/validation-receipt-types';

/** The fields a client sees. No key bytes, no row IDs. */
export interface ReceiptPayload {
  capabilities: readonly KeyCapability[];
  budget: {
    monthlyBudgetUsd: number | null;
    monthSpentUsd: number;
    cooldownUntil: number | null;
  };
  budgetStatus: ValidationReceipt['verdict']['outcome'];
}

interface KeyPolicyRow {
  capability_mask?: string | null;
  monthly_budget_usd?: number | null;
  cooldown_until?: number | null;
}

const CAPABILITY_VALUES = new Set<string>(['json_schema', 'tool_call', 'vision']);

function parseCapabilityMask(raw: string | null | undefined): KeyCapability[] | undefined {
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  const parsed = raw
    .split(',')
    .map((c) => c.trim())
    .filter((c): c is KeyCapability => CAPABILITY_VALUES.has(c));
  return parsed.length > 0 ? parsed : undefined;
}

/**
 * Outcome of the policy read. A missing row is distinct from a failed read: a
 * missing row means the resolved key was never written with a policy and the
 * gate must refuse rather than fall back to the provider table.
 */
export type KeyPolicyReadOutcome =
  | { readonly status: 'found'; readonly row: KeyPolicyRow; readonly monthSpentUsd: number }
  | { readonly status: 'absent' }
  | { readonly status: 'unreadable' };

/** Start of the UTC calendar month containing `nowUnix` (in Unix seconds). */
export function computeUtcMonthStartUnix(nowUnix: number): number {
  const d = new Date(nowUnix * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0) / 1000);
}

/**
 * Sums month-to-date `total_cost_cents` from `agent_runs` across the user's
 * workspaces (plus `userId` itself for direct personal runs) and converts to USD.
 * Fails open to `0` if `agent_runs` or `org_members` is unavailable so a transient
 * telemetry read failure never looks like an exhausted budget.
 */
export async function readMonthlySpendUsd(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  userId: string,
  nowUnix: number,
): Promise<number> {
  try {
    let workspaceIds: string[] = [];
    try {
      workspaceIds = await getUserWorkspaceIds(userId, db);
    } catch {
      workspaceIds = [];
    }
    const scopeIds = Array.from(new Set([userId, ...workspaceIds].filter(Boolean)));
    if (scopeIds.length === 0) return 0;

    const monthStartUnix = computeUtcMonthStartUnix(nowUnix);
    const placeholders = scopeIds.map(() => '?').join(', ');
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(total_cost_cents), 0) AS total_cents
         FROM agent_runs
         WHERE workspace_id IN (${placeholders}) AND created_at >= ?`,
      )
      .bind(...scopeIds, monthStartUnix)
      .first<{ total_cents?: number | string | null }>();

    const rawCents = Number(row?.total_cents ?? 0);
    if (!Number.isFinite(rawCents) || rawCents <= 0) return 0;
    return Math.round(rawCents) / 100;
  } catch (err) {
    logger.debug('[receipt-payload] monthly spend read unavailable', {
      error: getErrorMessage(err),
    });
    return 0;
  }
}

/** Reads the stored policy columns and month-to-date spend for one user+provider. */
async function readKeyPolicyRow(
  userId: string,
  provider: string,
  nowUnix: number,
): Promise<KeyPolicyReadOutcome> {
  try {
    const db = await getD1();
    if (!db) return { status: 'unreadable' };
    const row = await db
      .prepare(
        `SELECT capability_mask, monthly_budget_usd, cooldown_until
         FROM user_api_keys WHERE user_id = ? AND provider = ? LIMIT 1`,
      )
      .bind(userId, provider)
      .first<KeyPolicyRow>();
    if (!row) return { status: 'absent' };
    const monthSpentUsd = await readMonthlySpendUsd(db, userId, nowUnix);
    return { status: 'found', row, monthSpentUsd };
  } catch (err) {
    logger.debug('[receipt-payload] policy read unavailable', {
      provider,
      error: getErrorMessage(err),
    });
    return { status: 'unreadable' };
  }
}

function rowToBudgetState(row: KeyPolicyRow | null, monthSpentUsd: number): KeyBudgetState {
  if (!row) return { monthlyBudgetUsd: null, monthSpentUsd: 0, cooldownUntil: null };
  return {
    monthlyBudgetUsd: typeof row.monthly_budget_usd === 'number' ? row.monthly_budget_usd : null,
    monthSpentUsd,
    cooldownUntil: typeof row.cooldown_until === 'number' ? row.cooldown_until : null,
  };
}

export async function buildReceiptPayload(args: {
  userId: string;
  provider: string;
  maskedKey: string;
  nowUnix: number;
}): Promise<{ payload: ReceiptPayload; receipt: ValidationReceipt }> {
  const read = await readKeyPolicyRow(args.userId, args.provider, args.nowUnix);
  const row = read.status === 'found' ? read.row : null;
  const monthSpentUsd = read.status === 'found' ? read.monthSpentUsd : 0;
  const receipt = buildValidationReceipt({
    provider: args.provider,
    maskedKey: args.maskedKey,
    probedCapabilities: parseCapabilityMask(row?.capability_mask),
    budget: rowToBudgetState(row, monthSpentUsd),
    policyStatus: read.status,
    nowUnix: args.nowUnix,
  });
  return {
    payload: {
      capabilities: receipt.capabilities,
      budget: {
        monthlyBudgetUsd: receipt.budget.monthlyBudgetUsd,
        monthSpentUsd: receipt.budget.monthSpentUsd,
        cooldownUntil: receipt.budget.cooldownUntil,
      },
      budgetStatus: receipt.verdict.outcome,
    },
    receipt,
  };
}
