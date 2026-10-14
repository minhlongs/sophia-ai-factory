'use server';

/**
 * @file omnipresent-supreme-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omnipresent Supreme Conclave arbitration, constitutional invariant checks, and 4,194,304-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateOmnipresentSupremeConclaveDispute,
  verifyOmnipresentEmpireConstitutionalInvariants,
  type OmnipresentEmpireDisputeInput,
} from '@/tree/governance/omnipresent-supreme-conclave-engine';
import { compactStateWithOmniversalHolographicStark } from '@/tree/crypto/omniversal-holographic-stark-engine';
import type {
  OmnipresentEmpireConstitutionalInvariant,
  OmniversalEmpireTransaction,
} from '@/seed/types/omniversal-holographic-stark-conclave';
import {
  insertOmnipresentDisputeRecord,
  insertOmniversalStarkBatchRecord,
  upsertOmnipresentInvariantRecord,
  type OmnipresentSupremeDisputeActionResult,
  type OmniversalHolographicCompactionActionResult,
  type OmnipresentEmpireInvariantActionResult,
} from './omnipresent-supreme-conclave-persistence';

export type {
  OmnipresentSupremeDisputeActionResult,
  OmniversalHolographicCompactionActionResult,
  OmnipresentEmpireInvariantActionResult,
} from './omnipresent-supreme-conclave-persistence';

/**
 * Server Action to arbitrate an Omnipresent dispute via Supreme Conclave (99.9999999% consensus).
 */
export async function arbitrateOmnipresentSupremeDisputeAction(
  input: OmnipresentEmpireDisputeInput,
): Promise<OmnipresentSupremeDisputeActionResult> {
  try {
    const data = arbitrateOmnipresentSupremeConclaveDispute(input);
    const db = await getD1();
    if (db) {
      await insertOmnipresentDisputeRecord(db, input, data);
    }
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Omnipresent Supreme Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 4,194,304-bit STARK proof in <100 ns.
 */
export async function compactOmniversalHolographicStateAction(
  previousStateRoot: string,
  transactions: OmniversalEmpireTransaction[],
  circuitIdentifier: string = 'OMNIVERSAL_HOLOGRAPHIC_STARK_4194304_RECURSIVE_100B_V1',
): Promise<OmniversalHolographicCompactionActionResult> {
  try {
    const data = compactStateWithOmniversalHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier,
    );
    const db = await getD1();
    if (db) {
      await insertOmniversalStarkBatchRecord(db, data);
    }
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact omniversal holographic state',
    };
  }
}

/**
 * Server Action to verify Omnipresent Empire constitutional invariants.
 */
export async function verifyOmnipresentEmpireInvariantsAction(
  invariants: OmnipresentEmpireConstitutionalInvariant[],
  targetArticleCode: string,
): Promise<OmnipresentEmpireInvariantActionResult> {
  try {
    const data = verifyOmnipresentEmpireConstitutionalInvariants(invariants, targetArticleCode);
    const db = await getD1();
    if (db) {
      await upsertOmnipresentInvariantRecord(db, data);
    }
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify omnipresent empire invariants',
    };
  }
}
