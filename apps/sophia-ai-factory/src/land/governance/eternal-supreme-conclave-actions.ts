'use server';

/**
 * @file eternal-supreme-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Eternal Supreme Conclave arbitration, constitutional invariant checks, and 8,388,608-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateEternalSupremeConclaveDispute,
  verifyEternalEmpireConstitutionalInvariants,
  type EternalEmpireDisputeInput,
} from '@/tree/governance/eternal-supreme-conclave-engine';
import { compactStateWithInfiniteHolographicStark } from '@/tree/crypto/infinite-holographic-stark-engine';
import type {
  EternalEmpireConstitutionalInvariant,
  InfiniteEmpireTransaction,
} from '@/seed/types/infinite-holographic-stark-conclave';
import {
  insertEternalDisputeRecord,
  insertInfiniteStarkBatchRecord,
  upsertEternalInvariantRecord,
  type EternalSupremeDisputeActionResult,
  type InfiniteHolographicCompactionActionResult,
  type EternalEmpireInvariantActionResult,
} from './eternal-supreme-conclave-persistence';

export type {
  EternalSupremeDisputeActionResult,
  InfiniteHolographicCompactionActionResult,
  EternalEmpireInvariantActionResult,
} from './eternal-supreme-conclave-persistence';

/**
 * Server Action to arbitrate an Eternal dispute via Supreme Conclave (99.99999999% consensus).
 */
export async function arbitrateEternalSupremeDisputeAction(
  input: EternalEmpireDisputeInput,
): Promise<EternalSupremeDisputeActionResult> {
  try {
    const data = arbitrateEternalSupremeConclaveDispute(input);
    const db = await getD1();
    if (db) {
      await insertEternalDisputeRecord(db, input, data);
    }
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Eternal Supreme Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 8,388,608-bit STARK proof in <50 ns.
 */
export async function compactInfiniteHolographicStateAction(
  previousStateRoot: string,
  transactions: InfiniteEmpireTransaction[],
  circuitIdentifier: string = 'INFINITE_HOLOGRAPHIC_STARK_8388608_RECURSIVE_200B_V1',
): Promise<InfiniteHolographicCompactionActionResult> {
  try {
    const data = compactStateWithInfiniteHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier,
    );
    const db = await getD1();
    if (db) {
      await insertInfiniteStarkBatchRecord(db, data);
    }
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact infinite holographic state',
    };
  }
}

/**
 * Server Action to verify Eternal Empire constitutional invariants.
 */
export async function verifyEternalEmpireInvariantsAction(
  invariants: EternalEmpireConstitutionalInvariant[],
  targetArticleCode: string,
): Promise<EternalEmpireInvariantActionResult> {
  try {
    const data = verifyEternalEmpireConstitutionalInvariants(invariants, targetArticleCode);
    const db = await getD1();
    if (db) {
      await upsertEternalInvariantRecord(db, data);
    }
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify eternal empire invariants',
    };
  }
}
