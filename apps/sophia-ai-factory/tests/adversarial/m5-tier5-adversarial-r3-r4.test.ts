/**
 * Phase 2 Tier 5 Adversarial Coverage Hardening Suite for Milestone M5:
 * Multi-Network Affiliate Commissions (R3) & Mekong AI Hybrid Edge Node Synchronization (R4)
 *
 * Empirical challenger harness verifying:
 * 1. SQLite status CHECK constraints across commission_ledger, payout_batches, and edge_nodes.
 * 2. 14-day hold promoter millisecond boundary and dual-entry ledger negative row clawback invariants.
 * 3. Web Crypto AES-256-GCM AEAD tamper resistance (bit flips throw MekongTamperError, zero data leakage).
 * 4. 15-second offline transition boundary (15000ms vs 15001ms) and 6-trigger hybrid router fallback.
 *
 * Zero :any types rule strictly enforced.
 *
 * @module tests/adversarial/m5-tier5-adversarial-r3-r4.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  recordCommissionEntry,
  recordClawbackAdjustment,
  flipPendingToPayable,
  getNetAffiliateBalance,
  getAffiliateBalanceBreakdown,
  calculatePayableAt,
} from '@/tree/affiliate/commission-ledger';
import { runHoldPromotionJob } from '@/forest/jobs/affiliate-hold-promoter';
import {
  encryptPayload,
  decryptPayload,
  bytesToBase64,
  base64ToBytes,
  MekongTamperError,
  MekongCryptoError,
  MekongPayloadError,
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
} from '@/tree/mekong/crypto';
import {
  checkClusterHealth,
  processNodeHeartbeat,
} from '@/tree/mekong/health';
import {
  routeInferenceTask,
  executeCloudFallback,
} from '@/tree/mekong/hybrid-router';
import type {
  InferenceTask,
  EncryptedPayloadEnvelope,
  MekongHeartbeatTelemetry,
} from '@/tree/mekong/types';

/**
 * Creates a deterministic in-memory D1 mock with strict SQLite schema and CHECK constraints.
 */
function createDeterministicD1(): { d1: D1Database; rawDb: InstanceType<typeof DatabaseSync> } {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS commission_ledger (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      network TEXT NOT NULL,
      external_conversion_id TEXT NOT NULL,
      sub_id TEXT,
      order_value_cents INTEGER NOT NULL DEFAULT 0,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'payable', 'paying', 'paid', 'clawback', 'clawed_back')),
      hold_days INTEGER NOT NULL DEFAULT 14,
      attributed_at INTEGER NOT NULL,
      payable_at INTEGER NOT NULL,
      payout_batch_id TEXT,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(network, external_conversion_id)
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      rail TEXT NOT NULL,
      total_amount_cents INTEGER NOT NULL DEFAULT 0,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'confirmed', 'reconciliation_failed')),
      tx_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      confirmed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS edge_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tunnel_url TEXT NOT NULL,
      bearer_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'OFFLINE', 'DEGRADED')),
      hardware_profile TEXT NOT NULL DEFAULT 'apple_m1_max',
      cost_kind TEXT NOT NULL DEFAULT 'unmetered',
      last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS edge_node_heartbeats (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES edge_nodes(id),
      status TEXT NOT NULL,
      latency_ms REAL NOT NULL DEFAULT 10.0,
      recorded_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  const d1 = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    batch: async (stmts: unknown[]) => Promise.all(stmts),
  } as unknown as D1Database;

  return { d1, rawDb: db };
}

describe('M5 Adversarial Hardening: Tier 5 Empirical Verification (R3 & R4)', () => {
  let d1: D1Database;
  let rawDb: InstanceType<typeof DatabaseSync>;
  const baseTimeMs = 1720000000000;

  beforeEach(() => {
    const created = createDeterministicD1();
    d1 = created.d1;
    rawDb = created.rawDb;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. SQLite Status CHECK Constraint Enforcement
  // =========================================================================
  describe('1. SQLite Status CHECK Constraint Enforcement', () => {
    it('enforces CHECK constraint on commission_ledger: accepts valid statuses and rejects forbidden ones', () => {
      const validStatuses = ['pending', 'payable', 'paying', 'paid', 'clawback', 'clawed_back'] as const;
      const forbiddenStatuses = ['approved', 'authorized', 'settled', 'failed', 'bogus', 'INVALID', ''];

      // Valid statuses must succeed
      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        expect(() => {
          rawDb.prepare(`
            INSERT INTO commission_ledger (
              id, affiliate_id, network, external_conversion_id, commission_cents,
              status, hold_days, attributed_at, payable_at
            ) VALUES (?, 'aff_valid', 'tiktok_shop', ?, 1000, ?, 14, 1000, 2000)
          `).run(`com_valid_${i}`, `ext_valid_${i}`, status);
        }).not.toThrow();
      }

      // Forbidden statuses must fail SQLite CHECK constraint
      for (let i = 0; i < forbiddenStatuses.length; i++) {
        const badStatus = forbiddenStatuses[i];
        expect(() => {
          rawDb.prepare(`
            INSERT INTO commission_ledger (
              id, affiliate_id, network, external_conversion_id, commission_cents,
              status, hold_days, attributed_at, payable_at
            ) VALUES (?, 'aff_bad', 'amazon', ?, 1000, ?, 14, 1000, 2000)
          `).run(`com_bad_${i}`, `ext_bad_${i}`, badStatus);
        }).toThrow(/CHECK constraint failed/);
      }
    });

    it('enforces CHECK constraint on payout_batches: accepts valid statuses and rejects forbidden ones', () => {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'confirmed', 'reconciliation_failed'] as const;
      const forbiddenStatuses = ['settled', 'success', 'clawback', 'in_flight', 'unknown', 'CONFIRMED'];

      // Valid statuses must succeed
      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        expect(() => {
          rawDb.prepare(`
            INSERT INTO payout_batches (id, rail, total_amount_cents, status)
            VALUES (?, 'nowpayments_usdt', 5000, ?)
          `).run(`batch_valid_${i}`, status);
        }).not.toThrow();
      }

      // Forbidden statuses must fail SQLite CHECK constraint
      for (let i = 0; i < forbiddenStatuses.length; i++) {
        const badStatus = forbiddenStatuses[i];
        expect(() => {
          rawDb.prepare(`
            INSERT INTO payout_batches (id, rail, total_amount_cents, status)
            VALUES (?, 'nowpayments_usdt', 5000, ?)
          `).run(`batch_bad_${i}`, badStatus);
        }).toThrow(/CHECK constraint failed/);
      }
    });

    it('enforces CHECK constraint on edge_nodes: accepts ONLINE, OFFLINE, DEGRADED and rejects forbidden ones', () => {
      const validStatuses = ['ONLINE', 'OFFLINE', 'DEGRADED'] as const;
      const forbiddenStatuses = ['online', 'offline', 'degraded', 'READY', 'ACTIVE', 'MAINTENANCE', 'ERROR', ''];

      // Valid statuses must succeed
      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        expect(() => {
          rawDb.prepare(`
            INSERT INTO edge_nodes (id, name, tunnel_url, bearer_token, status)
            VALUES (?, 'Node', 'https://node.cashclaw.cc', 'tok_secret', ?)
          `).run(`node_val_${i}`, status);
        }).not.toThrow();
      }

      // Forbidden statuses must fail SQLite CHECK constraint
      for (let i = 0; i < forbiddenStatuses.length; i++) {
        const badStatus = forbiddenStatuses[i];
        expect(() => {
          rawDb.prepare(`
            INSERT INTO edge_nodes (id, name, tunnel_url, bearer_token, status)
            VALUES (?, 'Node', 'https://node.cashclaw.cc', 'tok_secret', ?)
          `).run(`node_bad_${i}`, badStatus);
        }).toThrow(/CHECK constraint failed/);
      }
    });
  });

  // =========================================================================
  // 2. 14-Day Hold Promoter Logic & Dual-Entry Negative Row Clawback Invariants
  // =========================================================================
  describe('2. 14-Day Hold Promoter & Dual-Entry Ledger Clawbacks (R3)', () => {
    it('promotes pending rows to payable strictly at payable_at millisecond boundary', async () => {
      const attributedAt = baseTimeMs;
      const holdDays = 14;
      const payableAt = calculatePayableAt(attributedAt, holdDays); // baseTimeMs + 14 * 86400 * 1000

      expect(payableAt).toBe(attributedAt + 1209600000);

      // Insert commission with calculated payableAt
      await recordCommissionEntry(d1, {
        affiliateId: 'aff_boundary_test',
        network: 'tiktok_shop',
        externalConversionId: 'conv_boundary_exact',
        orderValueCents: 50000,
        commissionCents: 5000,
        attributedAt,
        payableAt,
      });

      // 1. T - 1ms: Exactly 0 rows promoted
      const promotedBefore = await flipPendingToPayable(d1, payableAt - 1);
      expect(promotedBefore).toBe(0);

      const beforeCheck = await d1
        .prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('conv_boundary_exact')
        .first<{ status: string }>();
      expect(beforeCheck?.status).toBe('pending');

      // 2. T exact: Exactly 1 row promoted to payable
      const promotedExact = await flipPendingToPayable(d1, payableAt);
      expect(promotedExact).toBe(1);

      const exactCheck = await d1
        .prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('conv_boundary_exact')
        .first<{ status: string }>();
      expect(exactCheck?.status).toBe('payable');

      // 3. T + 1ms: Already promoted, returns 0 additional changes
      const promotedAfter = await flipPendingToPayable(d1, payableAt + 1);
      expect(promotedAfter).toBe(0);
    });

    it('verifies runHoldPromotionJob runner executes promotion deterministically', async () => {
      const now = baseTimeMs;
      const maturePayableAt = now - 5000;
      const futurePayableAt = now + 5000;

      await recordCommissionEntry(d1, {
        affiliateId: 'aff_runner_1',
        network: 'clickbank',
        externalConversionId: 'conv_mature_runner',
        orderValueCents: 20000,
        commissionCents: 2000,
        payableAt: maturePayableAt,
      });

      await recordCommissionEntry(d1, {
        affiliateId: 'aff_runner_2',
        network: 'amazon_associates',
        externalConversionId: 'conv_future_runner',
        orderValueCents: 30000,
        commissionCents: 3000,
        payableAt: futurePayableAt,
      });

      const res = await runHoldPromotionJob(d1, now);
      expect(res.promotedCount).toBe(1);
      expect(res.promotedAtMs).toBe(now);

      const matureRow = await d1.prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?').bind('conv_mature_runner').first<{ status: string }>();
      const futureRow = await d1.prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?').bind('conv_future_runner').first<{ status: string }>();
      expect(matureRow?.status).toBe('payable');
      expect(futureRow?.status).toBe('pending');
    });

    it('preserves dual-entry ledger immutability on clawbacks and handles 25 concurrent partial clawbacks', async () => {
      const parentConvId = 'conv_parent_immutability';
      const affiliateId = 'aff_creator_top';
      const initialCommissionCents = 150000; // $1,500.00

      // Seed parent commission
      await recordCommissionEntry(d1, {
        affiliateId,
        network: 'accesstrade',
        externalConversionId: parentConvId,
        orderValueCents: 1000000,
        commissionCents: initialCommissionCents,
        attributedAt: baseTimeMs,
      });

      // Spawn 25 concurrent partial clawbacks of 2,000 cents ($20.00) each
      const NUM_CLAWBACKS = 25;
      const clawbackChunkCents = 2000;
      const clawbackPromises = Array.from({ length: NUM_CLAWBACKS }, (_, i) =>
        recordClawbackAdjustment(d1, parentConvId, clawbackChunkCents, baseTimeMs + i, `Partial refund #${i + 1}`),
      );

      const results = await Promise.all(clawbackPromises);

      // Verify all succeeded
      expect(results).toHaveLength(NUM_CLAWBACKS);
      for (const r of results) {
        expect(r.success).toBe(true);
        expect(r.amountCents).toBe(-clawbackChunkCents);
        expect(r.status).toBe('clawback');
      }

      // Verify parent row was NEVER mutated (strict immutability invariant)
      const parentRow = await d1
        .prepare('SELECT commission_cents, status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind(parentConvId)
        .first<{ commission_cents: number; status: string }>();
      expect(parentRow?.commission_cents).toBe(initialCommissionCents);
      expect(parentRow?.status).toBe('pending');

      // Verify net balance reflects exact deduction
      const net = await getNetAffiliateBalance(d1, affiliateId);
      expect(net).toBe(initialCommissionCents - NUM_CLAWBACKS * clawbackChunkCents); // 150,000 - 50,000 = 100,000 cents

      // Verify breakdown totals
      const breakdown = await getAffiliateBalanceBreakdown(d1, affiliateId);
      expect(breakdown.totalCommissionsCents).toBe(initialCommissionCents);
      expect(breakdown.totalClawbacksCents).toBe(NUM_CLAWBACKS * clawbackChunkCents);
      expect(breakdown.netCents).toBe(100000);
    });

    it('computes negative net balance correctly when clawbacks exceed initial commission (deficit case)', async () => {
      const parentConvId = 'conv_over_clawback';
      const affiliateId = 'aff_deficit_test';

      await recordCommissionEntry(d1, {
        affiliateId,
        network: 'awin',
        externalConversionId: parentConvId,
        orderValueCents: 10000,
        commissionCents: 2500, // $25.00
      });

      // Clawback with chargeback penalty: $60.00 (6,000 cents)
      const clawbackRes = await recordClawbackAdjustment(d1, parentConvId, 6000, baseTimeMs);
      expect(clawbackRes.success).toBe(true);
      expect(clawbackRes.amountCents).toBe(-6000);

      // Net balance must be negative $35.00 (-3,500 cents)
      const net = await getNetAffiliateBalance(d1, affiliateId);
      expect(net).toBe(-3500);

      const breakdown = await getAffiliateBalanceBreakdown(d1, affiliateId);
      expect(breakdown.totalCommissionsCents).toBe(2500);
      expect(breakdown.totalClawbacksCents).toBe(6000);
      expect(breakdown.netCents).toBe(-3500);
    });
  });

  // =========================================================================
  // 3. Web Crypto AES-256-GCM AEAD Tamper Resistance
  // =========================================================================
  describe('3. Web Crypto AES-256-GCM AEAD Tamper Resistance (R4)', () => {
    const secret = 'mekong_production_tunnel_secret_key_32_bytes!';
    const payload = {
      action: 'execute_local_inference',
      model: 'qwen3:32b',
      temperature: 0.1,
      systemPrompt: 'Internal system prompt that must remain confidential',
      inputTokens: [101, 2054, 2003, 102],
      tenant: {
        id: 'tenant_omega_9',
        tier: 'ENTERPRISE',
        activeKeys: ['sk-key-1', 'sk-key-2'],
      },
    };

    it('encrypts and decrypts legitimate payloads with fresh IV per execution', async () => {
      const env1 = await encryptPayload(payload, secret);
      const env2 = await encryptPayload(payload, secret);

      expect(env1.algorithm).toBe('AES-256-GCM');
      expect(env1.version).toBe('v1');
      expect(env1.iv).not.toEqual(env2.iv); // Semantic security: fresh IV
      expect(env1.ciphertext).not.toEqual(env2.ciphertext);

      const decrypted = await decryptPayload<typeof payload>(env1, secret);
      expect(decrypted).toEqual(payload);
    });

    it('empirically rejects 100 randomized bit-flip trials on ciphertext with MekongTamperError (0% leakage)', async () => {
      const envelope = await encryptPayload(payload, secret);
      const rawBytes = base64ToBytes(envelope.ciphertext);
      const totalBytes = rawBytes.length;

      expect(totalBytes).toBeGreaterThan(AUTH_TAG_LENGTH_BYTES);

      let attempts = 0;
      let tamperErrorsCaught = 0;
      let leakedDataCount = 0;

      // Deterministic PRNG
      let seed = 4201337;
      const prng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 0; i < 100; i++) {
        attempts++;
        const byteIndex = Math.floor(prng() * totalBytes);
        const bitIndex = Math.floor(prng() * 8);

        const tamperedBytes = new Uint8Array(rawBytes);
        tamperedBytes[byteIndex] ^= (1 << bitIndex);

        const tamperedEnv: EncryptedPayloadEnvelope = {
          ...envelope,
          ciphertext: bytesToBase64(tamperedBytes),
        };

        let leakedResult: unknown = null;
        try {
          leakedResult = await decryptPayload(tamperedEnv, secret);
        } catch (err: unknown) {
          if (err instanceof MekongTamperError || err instanceof MekongCryptoError) {
            tamperErrorsCaught++;
          }
        }

        if (leakedResult !== null) {
          leakedDataCount++;
        }
      }

      expect(attempts).toBe(100);
      expect(tamperErrorsCaught).toBe(100);
      expect(leakedDataCount).toBe(0);
    });

    it('empirically rejects 50 randomized bit-flip trials on IV with MekongTamperError (0% leakage)', async () => {
      const envelope = await encryptPayload(payload, secret);
      const rawIv = base64ToBytes(envelope.iv);
      expect(rawIv.length).toBe(IV_LENGTH_BYTES); // 12 bytes

      let attempts = 0;
      let tamperErrorsCaught = 0;
      let leakedDataCount = 0;

      let seed = 7331999;
      const prng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 0; i < 50; i++) {
        attempts++;
        const byteIndex = Math.floor(prng() * IV_LENGTH_BYTES);
        const bitIndex = Math.floor(prng() * 8);

        const tamperedIv = new Uint8Array(rawIv);
        tamperedIv[byteIndex] ^= (1 << bitIndex);

        const tamperedEnv: EncryptedPayloadEnvelope = {
          ...envelope,
          iv: bytesToBase64(tamperedIv),
        };

        let leakedResult: unknown = null;
        try {
          leakedResult = await decryptPayload(tamperedEnv, secret);
        } catch (err: unknown) {
          if (err instanceof MekongTamperError || err instanceof MekongCryptoError) {
            tamperErrorsCaught++;
          }
        }

        if (leakedResult !== null) {
          leakedDataCount++;
        }
      }

      expect(attempts).toBe(50);
      expect(tamperErrorsCaught).toBe(50);
      expect(leakedDataCount).toBe(0);
    });

    it('rejects decryption when using incorrect secret key', async () => {
      const envelope = await encryptPayload(payload, secret);
      await expect(decryptPayload(envelope, 'wrong_secret_token_12345')).rejects.toThrow(MekongTamperError);
    });

    it('rejects invalid or truncated IV / ciphertext length', async () => {
      const envelope = await encryptPayload(payload, secret);

      // IV length 6 bytes instead of 12
      const badIvEnvelope: EncryptedPayloadEnvelope = {
        ...envelope,
        iv: bytesToBase64(new Uint8Array(6)),
      };
      await expect(decryptPayload(badIvEnvelope, secret)).rejects.toThrow(MekongPayloadError);

      // Ciphertext length shorter than 16-byte auth tag
      const badCtEnvelope: EncryptedPayloadEnvelope = {
        ...envelope,
        ciphertext: bytesToBase64(new Uint8Array(8)),
      };
      await expect(decryptPayload(badCtEnvelope, secret)).rejects.toThrow(MekongPayloadError);
    });
  });

  // =========================================================================
  // 4. 15-Second Offline Transition Boundary & 6-Trigger Hybrid Router Fallback
  // =========================================================================
  describe('4. 15-Second Offline Transition Boundary & 6-Trigger Router Fallback (R4)', () => {
    it('evaluates exact 15-second staleness boundary: 15000ms stays ONLINE, 15001ms transitions to OFFLINE', async () => {
      // Node 1: exactly 15,000ms stale
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_15000', 'Exact 15000ms', 'https://15000.cashclaw.cc', 'tok_15000', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 15000, baseTimeMs).run();

      // Node 2: exactly 15,001ms stale
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_15001', 'Stale 15001ms', 'https://15001.cashclaw.cc', 'tok_15001', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 15001, baseTimeMs).run();

      // Node 3: 14,999ms fresh
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_14999', 'Fresh 14999ms', 'https://14999.cashclaw.cc', 'tok_14999', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 14999, baseTimeMs).run();

      const health = await checkClusterHealth(d1, baseTimeMs, 15);
      expect(health.totalNodes).toBe(3);
      expect(health.onlineCount).toBe(2);
      expect(health.offlineCount).toBe(1);
      expect(health.transitionsToOffline).toEqual(['node_15001']);
      expect(health.transitionsToOffline).not.toContain('node_15000');
      expect(health.transitionsToOffline).not.toContain('node_14999');

      // Verify persistence in D1
      const n15000 = await d1.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_15000').first<{ status: string }>();
      const n15001 = await d1.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_15001').first<{ status: string }>();
      const n14999 = await d1.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_14999').first<{ status: string }>();
      expect(n15000?.status).toBe('ONLINE');
      expect(n15001?.status).toBe('OFFLINE');
      expect(n14999?.status).toBe('ONLINE');
    });

    it('verifies lazy D1 transition in routeInferenceTask at 15000ms vs 15001ms', async () => {
      const task: InferenceTask = {
        taskId: 'task_eval_staleness',
        type: 'llm',
        prompt: 'Mathematical boundary test',
        model: 'qwen3:32b',
      };

      // Node A: 15,000ms stale -> routes locally
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_r_15000', 'Router 15000ms', 'https://r15000.cashclaw.cc', 'tok_r', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 15000, baseTimeMs).run();

      const resOnline = await routeInferenceTask(task, d1, 'node_r_15000', baseTimeMs);
      expect(resOnline.provider).toBe('mekong_m1_max');
      expect(resOnline.costKind).toBe('unmetered');
      expect(resOnline.fallbackTriggered).toBe(false);

      // Node B: 15,001ms stale -> falls back with STALE_HEARTBEAT and marks OFFLINE
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_r_15001', 'Router 15001ms', 'https://r15001.cashclaw.cc', 'tok_r', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 15001, baseTimeMs).run();

      const resStale = await routeInferenceTask(task, d1, 'node_r_15001', baseTimeMs);
      expect(resStale.provider).toBe('cloud_byok');
      expect(resStale.costKind).toBe('metered');
      expect(resStale.fallbackTriggered).toBe(true);
      expect(resStale.fallbackReason).toBe('STALE_HEARTBEAT');

      const persistedStale = await d1.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_r_15001').first<{ status: string }>();
      expect(persistedStale?.status).toBe('OFFLINE');
    });

    it('verifies all 6 hybrid router fallback triggers and economic honesty invariant', async () => {
      const task: InferenceTask = {
        taskId: 'task_triggers_check',
        type: 'llm',
        prompt: 'Check all fallback triggers',
        model: 'qwen3:32b',
      };

      // Trigger 1: NO_ONLINE_NODE (empty database)
      const resTrigger1 = await routeInferenceTask(task, d1, undefined, baseTimeMs);
      expect(resTrigger1.fallbackTriggered).toBe(true);
      expect(resTrigger1.fallbackReason).toBe('NO_ONLINE_NODE');
      expect(resTrigger1.costKind).toBe('metered');

      // Populate an online node
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_active_now', 'Active Node', 'https://active.cashclaw.cc', 'tok_act', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 200, baseTimeMs).run();

      // Trigger 2: PREFERRED_NODE_NOT_FOUND (invalid ID)
      const resTrigger2 = await routeInferenceTask(task, d1, 'non_existent_node_id_404', baseTimeMs);
      expect(resTrigger2.fallbackTriggered).toBe(true);
      expect(resTrigger2.fallbackReason).toBe('PREFERRED_NODE_NOT_FOUND');
      expect(resTrigger2.costKind).toBe('metered');

      // Trigger 3: NODE_OFFLINE (node explicitly OFFLINE or DEGRADED)
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_explicit_off', 'Explicit Off', 'https://off.cashclaw.cc', 'tok_off', 'OFFLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 200, baseTimeMs).run();

      const resTrigger3 = await routeInferenceTask(task, d1, 'node_explicit_off', baseTimeMs);
      expect(resTrigger3.fallbackTriggered).toBe(true);
      expect(resTrigger3.fallbackReason).toBe('NODE_OFFLINE');
      expect(resTrigger3.costKind).toBe('metered');

      // Trigger 4: STALE_HEARTBEAT (>15000ms staleness)
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_stale_heartbeat', 'Stale Node', 'https://stale.cashclaw.cc', 'tok_stale', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 30000, baseTimeMs).run();

      const resTrigger4 = await routeInferenceTask(task, d1, 'node_stale_heartbeat', baseTimeMs);
      expect(resTrigger4.fallbackTriggered).toBe(true);
      expect(resTrigger4.fallbackReason).toBe('STALE_HEARTBEAT');
      expect(resTrigger4.costKind).toBe('metered');

      // Trigger 5: PROBE_FAILED (probe fails or simulated network error)
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('node_probe_failure', 'Probe Fail', 'https://node-unreachable.cashclaw.cc', 'tok_probe', 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 200, baseTimeMs).run();

      const resTrigger5 = await routeInferenceTask(task, d1, 'node_probe_failure', baseTimeMs);
      expect(resTrigger5.fallbackTriggered).toBe(true);
      expect(resTrigger5.fallbackReason).toBe('PROBE_FAILED');
      expect(resTrigger5.costKind).toBe('metered');

      // Trigger 6: TUNNEL_TIMEOUT (aborted/timeout error caught without crash)
      const timeoutDb = {
        prepare(_sql: string) {
          throw new Error('Cloudflare Tunnel timeout after 2500ms (AbortError)');
        },
        exec: async () => ({ count: 0, duration: 0 }),
        batch: async () => [],
      } as unknown as D1Database;

      const resTrigger6 = await routeInferenceTask(task, timeoutDb, 'node_active_now', baseTimeMs);
      expect(resTrigger6.fallbackTriggered).toBe(true);
      expect(resTrigger6.fallbackReason).toBe('TUNNEL_TIMEOUT');
      expect(resTrigger6.costKind).toBe('metered');

      // Economic honesty verification:
      // Local execution is strictly unmetered ($0.00 marginal cost)
      const resLocal = await routeInferenceTask(task, d1, 'node_active_now', baseTimeMs);
      expect(resLocal.provider).toBe('mekong_m1_max');
      expect(resLocal.costKind).toBe('unmetered');
      expect(resLocal.fallbackTriggered).toBe(false);

      // Cloud fallback is strictly metered (commercial cloud billing)
      const resDirectFallback = executeCloudFallback(task, 'NO_ONLINE_NODE');
      expect(resDirectFallback.provider).toBe('cloud_byok');
      expect(resDirectFallback.costKind).toBe('metered');
      expect(resDirectFallback.fallbackTriggered).toBe(true);
    });

    it('verifies node recovery lifecycle from OFFLINE back to ONLINE on fresh heartbeat', async () => {
      const nodeId = 'node_lifecycle_test';
      const bearerToken = 'tok_lifecycle_secret';

      // Insert stale node (25 seconds stale)
      await d1.prepare(`
        INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(nodeId, 'Lifecycle Node', 'https://lifecycle.cashclaw.cc', bearerToken, 'ONLINE', 'apple_m1_max', 'unmetered', baseTimeMs - 25000, baseTimeMs).run();

      // Cluster health check sweeps node to OFFLINE
      const sweep = await checkClusterHealth(d1, baseTimeMs, 15);
      expect(sweep.transitionsToOffline).toContain(nodeId);

      const statusOffline = await d1.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind(nodeId).first<{ status: string }>();
      expect(statusOffline?.status).toBe('OFFLINE');

      // Daemon sends fresh heartbeat at baseTimeMs + 5000
      const heartbeatTimeMs = baseTimeMs + 5000;
      const telemetry: MekongHeartbeatTelemetry = {
        gpuUtilizationPct: 52.0,
        vramUsedBytes: 12 * 1024 * 1024 * 1024,
        vramTotalBytes: 32 * 1024 * 1024 * 1024,
        queueDepth: 0,
        latencyMs: 14.2,
      };

      const hbResult = await processNodeHeartbeat(
        d1,
        {
          nodeId,
          bearerToken,
          reportedStatus: 'ONLINE',
          telemetry,
        },
        heartbeatTimeMs,
      );

      expect(hbResult.success).toBe(true);
      expect(hbResult.status).toBe('ONLINE');

      // Verify node status in D1 is restored to ONLINE
      const statusRecovered = await d1.prepare('SELECT status, last_heartbeat_at FROM edge_nodes WHERE id = ?').bind(nodeId).first<{ status: string; last_heartbeat_at: number }>();
      expect(statusRecovered?.status).toBe('ONLINE');
      expect(statusRecovered?.last_heartbeat_at).toBe(heartbeatTimeMs);

      // Verify subsequent router call routes locally to mekong_m1_max
      const task: InferenceTask = {
        taskId: 'task_recovered_eval',
        type: 'llm',
        prompt: 'Post recovery prompt',
        model: 'qwen3:32b',
      };
      const routeRes = await routeInferenceTask(task, d1, nodeId, heartbeatTimeMs + 1000);
      expect(routeRes.provider).toBe('mekong_m1_max');
      expect(routeRes.costKind).toBe('unmetered');
      expect(routeRes.fallbackTriggered).toBe(false);
    });
  });
});
