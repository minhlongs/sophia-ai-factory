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

/**
 * Parses the stored capability mask, or returns undefined when there is none so
 * the provider table supplies the answer. An unreadable or unrecognised mask
 * yields undefined rather than a capability-less key: falling back to what the
 * provider is known to serve keeps a working key working.
 */
function parseCapabilityMask(raw: string | null | undefined): KeyCapability[] | undefined {
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  const parsed = raw
    .split(',')
    .map((c) => c.trim())
    .filter((c): c is KeyCapability => CAPABILITY_VALUES.has(c));
  return parsed.length > 0 ? parsed : undefined;
}

/**
 * Outcome of the policy read. A missing row is distinct from a failed read: the
 * caller can resolve a key row through the BYOK provider factory before the run
 * starts, so a missing row means the resolved key was never written with a
 * policy and the gate must refuse rather than fall back to the provider table,
 * which would happily satisfy every capability requirement.
 */
export type KeyPolicyReadOutcome =
  | { readonly status: 'found'; readonly row: KeyPolicyRow }
  | { readonly status: 'absent' }
  | { readonly status: 'unreadable' };

/** Reads the stored policy columns for one user+provider. */
async function readKeyPolicyRow(userId: string, provider: string): Promise<KeyPolicyReadOutcome> {
  let db: Awaited<ReturnType<typeof getD1>>;
  try {
    db = await getD1();
    if (!db) return { status: 'unreadable' };
    const row = await db
      .prepare(
        `SELECT capability_mask, monthly_budget_usd, cooldown_until
         FROM user_api_keys WHERE user_id = ? AND provider = ? LIMIT 1`,
      )
      .bind(userId, provider)
      .first<KeyPolicyRow>();
    return row ? { status: 'found', row } : { status: 'absent' };
  } catch (err) {
    logger.debug('[receipt-payload] policy read unavailable', {
      provider,
      error: getErrorMessage(err),
    });
    return { status: 'unreadable' };
  }
}

function rowToBudgetState(row: KeyPolicyRow | null): KeyBudgetState {
  if (!row) return { monthlyBudgetUsd: null, monthSpentUsd: 0, cooldownUntil: null };
  return {
    monthlyBudgetUsd: typeof row.monthly_budget_usd === 'number' ? row.monthly_budget_usd : null,
    monthSpentUsd: 0,
    cooldownUntil: typeof row.cooldown_until === 'number' ? row.cooldown_until : null,
  };
}

/**
 * Produces the receipt payload for a validated key. The receipt is returned
 * alongside it so a caller that needs the full verdict can act on it without
 * re-deriving the same data.
 *
 * A read that fails stays fail-open: the payload reports capabilities from the
 * provider table and no cap, because a transport failure must not read as an
 * exhausted budget and needlessly block a working key. A key that was never
 * written with a policy row is the one case that refuses — treating it as
 * unlimited would let a run proceed with no cap, no cooldown and no capability
 * probe at all.
 */
export async function buildReceiptPayload(args: {
  userId: string;
  provider: string;
  maskedKey: string;
  nowUnix: number;
}): Promise<{ payload: ReceiptPayload; receipt: ValidationReceipt }> {
  const read = await readKeyPolicyRow(args.userId, args.provider);
  const row = read.status === 'found' ? read.row : null;
  const receipt = buildValidationReceipt({
    provider: args.provider,
    maskedKey: args.maskedKey,
    probedCapabilities: parseCapabilityMask(row?.capability_mask),
    budget: rowToBudgetState(row),
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
