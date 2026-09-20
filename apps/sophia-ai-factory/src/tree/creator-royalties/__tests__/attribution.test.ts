/**
 * Unit Tests for Royalty Attribution & Lineage Engine
 *
 * @module tree/creator-royalties/__tests__/attribution.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateRoyaltyCents,
  calculateMultiTierSplit,
  recordBlueprintRemixAndAccrueRoyalty,
  accrueCreatorLedgerEntryCAS,
  isCircularAncestorRemix,
} from '../attribution';

// In-memory mock database for testing
function createMockD1() {
  const remixRows: Array<{
    id: string;
    blueprint_id: string;
    creator_id: string;
    remixer_id: string;
    mission_id: string;
    royalty_cents: number;
    created_at: number;
  }> = [];

  const ledgerRows: Array<{
    id: string;
    creator_id: string;
    source_type: string;
    reference_id: string;
    amount_cents: number;
    balance_after_cents: number;
    sequence_num: number;
    event_type: string;
    status: string;
    created_at: number;
  }> = [];

  const blueprintRows: Array<{
    id: string;
    creator_id: string;
    parent_blueprint_id?: string | null;
  }> = [];

  return {
    remixRows,
    ledgerRows,
    blueprintRows,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (sql.includes('FROM campaign_blueprints') && sql.includes('WHERE id = ?')) {
                const [bpId] = args as [string];
                const found = blueprintRows.find((b) => b.id === bpId);
                return (found ? (found as unknown as T) : null);
              }
              if (sql.includes('FROM creator_earnings_ledger') && sql.includes('reference_id = ?')) {
                const [creatorId, refId] = args as [string, string];
                const found = ledgerRows.find(
                  (r) => r.creator_id === creatorId && r.reference_id === refId,
                );
                return (found ? (found as unknown as T) : null);
              }
              if (sql.includes('FROM creator_earnings_ledger') && sql.includes('ORDER BY sequence_num DESC')) {
                const [creatorId] = args as [string];
                const rows = ledgerRows.filter((r) => r.creator_id === creatorId);
                rows.sort((a, b) => b.sequence_num - a.sequence_num);
                return (rows[0] ? (rows[0] as unknown as T) : null);
              }
              return null;
            },
            async all<T>(): Promise<{ results: T[] }> {
              return { results: [] };
            },
            async run(): Promise<{ success: boolean }> {
              if (sql.includes('INSERT INTO blueprint_remixes')) {
                const [id, blueprint_id, creator_id, remixer_id, , mission_id, royalty_cents, created_at] =
                  args as [string, string, string, string, string, string, number, number];
                remixRows.push({
                  id,
                  blueprint_id,
                  creator_id,
                  remixer_id,
                  mission_id,
                  royalty_cents,
                  created_at,
                });
              } else if (sql.includes('INSERT INTO creator_earnings_ledger')) {
                const [
                  id,
                  creator_id,
                  source_type,
                  reference_id,
                  amount_cents,
                  status,
                  created_at,
                  balance_after_cents,
                  sequence_num,
                  event_type,
                ] = args as [string, string, string, string, number, string, number, number, number, string];

                ledgerRows.push({
                  id,
                  creator_id,
                  source_type,
                  reference_id,
                  amount_cents,
                  balance_after_cents: balance_after_cents ?? amount_cents,
                  sequence_num: sequence_num ?? 1,
                  event_type: event_type ?? 'royalty_accrual',
                  status,
                  created_at,
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database & {
    remixRows: typeof remixRows;
    ledgerRows: typeof ledgerRows;
    blueprintRows: typeof blueprintRows;
  };
}

describe('Royalty Attribution Math', () => {
  describe('calculateRoyaltyCents', () => {
    it('truncates fractional cents towards zero (Math.floor)', () => {
      // 10% on $9.99 (999 cents) = 99.9 cents -> 99 cents
      expect(calculateRoyaltyCents(999, 10)).toBe(99);
      // 20% on $25.50 (2550 cents) = 510 cents
      expect(calculateRoyaltyCents(2550, 20)).toBe(510);
      // 15% on $100.00 (10000 cents) = 1500 cents
      expect(calculateRoyaltyCents(10000, 15)).toBe(1500);
    });

    it('handles boundary 0% and 100% royalty', () => {
      expect(calculateRoyaltyCents(5000, 0)).toBe(0);
      expect(calculateRoyaltyCents(5000, 100)).toBe(5000);
    });

    it('returns 0 for negative or zero revenue', () => {
      expect(calculateRoyaltyCents(0, 20)).toBe(0);
      expect(calculateRoyaltyCents(-500, 20)).toBe(0);
      expect(calculateRoyaltyCents(5000, -10)).toBe(0);
    });
  });

  describe('calculateMultiTierSplit', () => {
    it('allocates 100% to root creator when no parent is specified', () => {
      const split = calculateMultiTierSplit(10000, 10, 'creator_alice');
      expect(split.totalRoyaltyCents).toBe(1000);
      expect(split.rootCreatorId).toBe('creator_alice');
      expect(split.rootRoyaltyCents).toBe(1000);
      expect(split.parentCreatorId).toBeUndefined();
      expect(split.parentRoyaltyCents).toBeUndefined();
    });

    it('collapses self-parenting to 100% root share', () => {
      const split = calculateMultiTierSplit(10000, 10, 'creator_alice', 'creator_alice');
      expect(split.totalRoyaltyCents).toBe(1000);
      expect(split.rootRoyaltyCents).toBe(1000);
      expect(split.parentRoyaltyCents).toBeUndefined();
    });

    it('splits 70% root / 30% parent on derivative remix without penny leakage', () => {
      const split = calculateMultiTierSplit(10000, 10, 'creator_root', 'creator_parent');
      expect(split.totalRoyaltyCents).toBe(1000);
      expect(split.parentRoyaltyCents).toBe(300); // 30% of 1000
      expect(split.rootRoyaltyCents).toBe(700); // 70% of 1000
      expect((split.rootRoyaltyCents + (split.parentRoyaltyCents ?? 0))).toBe(split.totalRoyaltyCents);
    });

    it('allocates fractional penny remainder to root creator (conservation invariant)', () => {
      // 10% on 1010 cents = 101 cents total pool
      // 30% of 101 = 30.3 -> floor = 30 cents parent
      // root = 101 - 30 = 71 cents root
      const split = calculateMultiTierSplit(1010, 10, 'creator_root', 'creator_parent');
      expect(split.totalRoyaltyCents).toBe(101);
      expect(split.parentRoyaltyCents).toBe(30);
      expect(split.rootRoyaltyCents).toBe(71);
      expect(split.rootRoyaltyCents + (split.parentRoyaltyCents ?? 0)).toBe(101);
    });
  });

  describe('recordBlueprintRemixAndAccrueRoyalty', () => {
    let db: ReturnType<typeof createMockD1>;

    beforeEach(() => {
      db = createMockD1();
    });

    it('records remix in blueprint_remixes and accrues pending ledger entry', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_100',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_1',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(500);
      expect(db.remixRows).toHaveLength(1);
      expect(db.remixRows[0].blueprint_id).toBe('bp_100');
      expect(db.remixRows[0].creator_id).toBe('creator_alice');
      expect(db.remixRows[0].remixer_id).toBe('user_bob');

      expect(db.ledgerRows).toHaveLength(1);
      expect(db.ledgerRows[0].creator_id).toBe('creator_alice');
      expect(db.ledgerRows[0].amount_cents).toBe(500);
      expect(db.ledgerRows[0].status).toBe('pending');
    });

    it('blocks self-remix royalty fraud (CIRCULAR_SELF_REMIX_DENIED)', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_100',
        parentCreatorId: 'same_user',
        remixerUserId: 'same_user',
        missionId: 'mis_2',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(db.remixRows).toHaveLength(0);
      expect(db.ledgerRows).toHaveLength(0);
    });

    it('rejects invalid royalty percentages (< 0 or > 100)', async () => {
      const resNegative = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_100',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_3',
        revenueCents: 5000,
        royaltyPercent: -5,
      });
      expect(resNegative.success).toBe(false);
      expect(resNegative.error).toBe('INVALID_ROYALTY_PERCENT');

      const resOver100 = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_100',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_4',
        revenueCents: 5000,
        royaltyPercent: 120,
      });
      expect(resOver100.success).toBe(false);
      expect(resOver100.error).toBe('INVALID_ROYALTY_PERCENT');
    });

    it('maintains monotonic sequence numbers across multiple accruals for same creator', async () => {
      const first = await accrueCreatorLedgerEntryCAS(db, {
        creatorId: 'creator_alice',
        amountCents: 500,
        referenceId: 'ref_1',
      });
      expect(first.sequenceNum).toBe(1);
      expect(first.newBalanceCents).toBe(500);

      const second = await accrueCreatorLedgerEntryCAS(db, {
        creatorId: 'creator_alice',
        amountCents: 300,
        referenceId: 'ref_2',
      });
      expect(second.sequenceNum).toBe(2);
      expect(second.newBalanceCents).toBe(800);
    });

    it('blocks indirect multi-hop circular remix (A -> B -> A) with CIRCULAR_SELF_REMIX_DENIED', async () => {
      // Alice creates root blueprint
      db.blueprintRows.push({
        id: 'bp_root_alice',
        creator_id: 'alice',
        parent_blueprint_id: null,
      });

      // Bob remixes Alice's root blueprint
      db.blueprintRows.push({
        id: 'bp_deriv_bob',
        creator_id: 'bob',
        parent_blueprint_id: 'bp_root_alice',
      });

      // Alice attempts to remix Bob's derivative
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_deriv_bob',
        parentCreatorId: 'bob',
        remixerUserId: 'alice',
        missionId: 'mis_alice_loop',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);
      expect(db.remixRows).toHaveLength(0);
      expect(db.ledgerRows).toHaveLength(0);
    });

    it('blocks deep 3-tier circular remix (A -> B -> C -> A) with CIRCULAR_SELF_REMIX_DENIED', async () => {
      db.blueprintRows.push({ id: 'bp_1', creator_id: 'alice', parent_blueprint_id: null });
      db.blueprintRows.push({ id: 'bp_2', creator_id: 'bob', parent_blueprint_id: 'bp_1' });
      db.blueprintRows.push({ id: 'bp_3', creator_id: 'charlie', parent_blueprint_id: 'bp_2' });

      // Alice attempts to remix bp_3 (originated from Alice 3 hops ago)
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_3',
        parentCreatorId: 'charlie',
        remixerUserId: 'alice',
        missionId: 'mis_alice_deep_loop',
        revenueCents: 8000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(db.remixRows).toHaveLength(0);
    });

    it('permits valid non-circular derivative remix (A -> B -> C where David remixes C)', async () => {
      db.blueprintRows.push({ id: 'bp_1', creator_id: 'alice', parent_blueprint_id: null });
      db.blueprintRows.push({ id: 'bp_2', creator_id: 'bob', parent_blueprint_id: 'bp_1' });
      db.blueprintRows.push({ id: 'bp_3', creator_id: 'charlie', parent_blueprint_id: 'bp_2' });

      // David remixes bp_3 (David is not in the ancestor tree)
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_3',
        parentCreatorId: 'charlie',
        remixerUserId: 'david',
        missionId: 'mis_david_ok',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(1000);
      expect(db.remixRows).toHaveLength(1);
    });

    it('detects cyclic parent pointers (A -> B -> A loop in parent_blueprint_id) and denies', async () => {
      // Corrupted cyclic graph
      db.blueprintRows.push({ id: 'bp_cycle_a', creator_id: 'bob', parent_blueprint_id: 'bp_cycle_b' });
      db.blueprintRows.push({ id: 'bp_cycle_b', creator_id: 'charlie', parent_blueprint_id: 'bp_cycle_a' });

      const isCycle = await isCircularAncestorRemix(db, 'bp_cycle_a', 'david');
      expect(isCycle).toBe(true);

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_cycle_a',
        parentCreatorId: 'bob',
        remixerUserId: 'david',
        missionId: 'mis_cycle',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });
  });
});
