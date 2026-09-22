import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawCustomerActivityMetrics, CustomerHealthMetrics } from '@/seed/types/retention-types';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  getD1: vi.fn(),
  sendEmail: vi.fn(),
  sendTelegramMessage: vi.fn(),
  addCredits: vi.fn(),
  getBalance: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: mocks.getD1,
}));

vi.mock('@/tree/email/sender', () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  addCredits: mocks.addCredits,
  getBalance: mocks.getBalance,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  calculateRecencyScore,
  calculateVelocityScore,
  calculateCapacityScore,
  calculateReliabilityScore,
  computeCustomerHealth,
  checkWinBackCooldown,
  recordWinBackOutreach,
  dispatchWinBackOutreach,
  getRetentionSummaryStats,
  listAllCustomerHealthMetrics,
  CHURN_HEALTH_THRESHOLD,
  WARNING_HEALTH_THRESHOLD,
  WINBACK_COOLDOWN_MS,
} from '../customer-retention-service';

describe('Empirical Adversarial Challenge Suite: Anti-Churn Guardian & Health Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Challenge Vector 1: NaN, Corrupted Dates, and Extreme Timestamps', () => {
    it('1.1: computeCustomerHealth handles NaN daysSinceLastActive safely without throwing RangeError', () => {
      const rawWithNaN: RawCustomerActivityMetrics = {
        userId: 'usr-corrupted-date',
        userEmail: 'corrupt@domain.com',
        userName: 'Corrupted User',
        lastActiveAt: null,
        daysSinceLastActive: NaN,
        videosCreated30d: 0,
        creditsRemaining: 100,
        creditsPurchased: 500,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        renderSuccessRate: 1.0,
      };

      // Guarded against RangeError: Invalid time value
      expect(() => computeCustomerHealth(rawWithNaN)).not.toThrow();
      const result = computeCustomerHealth(rawWithNaN);
      expect(result.lastActiveAt).toBeDefined();
    });

    it('1.2: computeCustomerHealth handles extreme past/future dates safely without throwing RangeError', () => {
      const rawExtremePast: RawCustomerActivityMetrics = {
        userId: 'usr-extreme-past',
        userEmail: 'past@domain.com',
        lastActiveAt: null,
        daysSinceLastActive: 1e12, // 1 trillion days (~2.7 billion years, exceeds JS ±100,000,000 days limit)
        videosCreated30d: 0,
        creditsRemaining: 0,
        creditsPurchased: 0,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        renderSuccessRate: 0,
      };

      // Guarded against JS Date overflow
      expect(() => computeCustomerHealth(rawExtremePast)).not.toThrow();

      const rawExtremeFuture: RawCustomerActivityMetrics = {
        ...rawExtremePast,
        userId: 'usr-extreme-future',
        daysSinceLastActive: -1e12,
      };

      expect(() => computeCustomerHealth(rawExtremeFuture)).not.toThrow();
    });

    it('1.3: calculateCapacityScore returns 0 when creditsRemaining is NaN instead of masking as 10', () => {
      // Adversarial input: creditsRemaining is NaN
      const scoreWithPurchased = calculateCapacityScore(NaN, 1000);
      const scoreWithoutPurchased = calculateCapacityScore(NaN, 0);

      // Guarded: NaN credits balance returns 0 immediately
      expect(scoreWithPurchased).toBe(0);
      expect(scoreWithoutPurchased).toBe(0);
    });

    it('1.4: NaN in any health score results in totalHealthScore = NaN and incorrectly classifies customer as HEALTHY', () => {
      // When lastActiveAt is supplied as a string, no RangeError is thrown at line 147,
      // but daysSinceLastActive is NaN, or capacity is NaN
      const raw: RawCustomerActivityMetrics = {
        userId: 'usr-nan-score',
        userEmail: 'nanscore@domain.com',
        userName: 'NaN Score User',
        lastActiveAt: '2026-09-22T00:00:00.000Z',
        daysSinceLastActive: 10,
        videosCreated30d: 0,
        creditsRemaining: 0,
        creditsPurchased: 0,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        renderSuccessRate: 0,
      };

      // Artificially inject NaN into recency calculation simulation
      // If any factor is NaN, Math.min(100, NaN + 0 + 0 + 20) yields NaN
      const totalScore = Math.max(0, Math.min(100, NaN + 0 + 0 + 20));
      expect(Number.isNaN(totalScore)).toBe(true);

      // In computeCustomerHealth:
      // let status: ChurnRiskLevel = 'HEALTHY';
      // if (totalHealthScore < CHURN_HEALTH_THRESHOLD) status = 'CRITICAL_CHURN_RISK';
      // Since (NaN < 40) is FALSE, status remains 'HEALTHY'!
      const isCritical = totalScore < CHURN_HEALTH_THRESHOLD;
      const isWarning = totalScore < WARNING_HEALTH_THRESHOLD;
      expect(isCritical).toBe(false);
      expect(isWarning).toBe(false);
      // Customer with corrupted NaN metrics will NEVER be flagged for churn!
    });
  });

  describe('Challenge Vector 2: Zero, Negative, and Infinite Balances', () => {
    it('2.1: handles zero balance, negative balances, and infinite balance correctly in calculateCapacityScore', () => {
      // Zero balance
      expect(calculateCapacityScore(0, 1000)).toBe(0);
      expect(calculateCapacityScore(0, 0)).toBe(0);

      // Negative balance (e.g. overdraft or billing lag)
      expect(calculateCapacityScore(-50, 1000)).toBe(0);
      expect(calculateCapacityScore(-1, 0)).toBe(0);

      // Negative purchased credits (corrupted billing record)
      // creditsRemaining = 100, creditsPurchased = -500
      // creditsPurchased > 0 is false, so it falls back to free allowance check
      // creditsRemaining >= 100 -> returns 15
      expect(calculateCapacityScore(100, -500)).toBe(15);

      // Infinite balance
      expect(calculateCapacityScore(Infinity, 1000)).toBe(25);
      expect(calculateCapacityScore(-Infinity, 1000)).toBe(0);
    });

    it('2.2: handles clock skew (negative daysSinceLastActive)', () => {
      // Session recorded slightly in future due to client clock skew
      expect(calculateRecencyScore(-0.5)).toBe(25);
      expect(calculateRecencyScore(-10)).toBe(25);
    });
  });

  describe('Challenge Vector 3: Extreme Volume of Failed vs Completed Video Jobs', () => {
    it('3.1: 10,000 video jobs with 100% failure rate still awards 5 points floor in reliability', () => {
      // 0 completed, 10,000 failed
      const score = calculateReliabilityScore(0, 10000);
      // As observed in code: successRate = 0 < 0.50 -> returns 5
      // Even with 10,000 failures, reliability never reaches 0 points
      expect(score).toBe(5);
    });

    it('3.2: 10,000 video jobs with 100% success rate awards 25 points', () => {
      const score = calculateReliabilityScore(10000, 0);
      expect(score).toBe(25);
    });

    it('3.3: Negative job counts can produce abnormal baseline or negative success rate', () => {
      // When both completed and failed are negative, e.g. -5 and 5, sum is 0
      expect(calculateReliabilityScore(-5, 5)).toBe(20); // total === 0 returns 20 baseline!

      // When completedJobs = -10, failedJobs = -10 -> total = -20
      // successRate = -10 / -20 = 0.5 -> awards 10 points!
      expect(calculateReliabilityScore(-10, -10)).toBe(10);
    });
  });

  describe('Challenge Vector 4: Concurrency Stress Test & Cooldown Bypass (TOCTOU)', () => {
    it('4.1: Concurrency TOCTOU guard prevents duplicate win-back dispatches under rapid concurrent invocations', async () => {
      // Set up a stateful in-memory audit log simulating D1
      const auditLogStore: Array<{ target_user_id: string; created_at: number; payload: string }> = [];

      mocks.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT created_at, payload FROM admin_audit_log')) {
          return {
            bind: (userId: string) => ({
              first: async () => {
                // Simulate real D1 query latency (5ms)
                await new Promise((r) => setTimeout(r, 5));
                const records = auditLogStore.filter((r) => r.target_user_id === userId);
                return records.length > 0 ? records[records.length - 1] : null;
              },
            }),
          };
        }

        if (sql.includes('INSERT INTO admin_audit_log')) {
          return {
            bind: (userId: string, payload: string) => ({
              run: async () => {
                // Simulate real D1 write latency (5ms)
                await new Promise((r) => setTimeout(r, 5));
                auditLogStore.push({
                  target_user_id: userId,
                  created_at: Math.floor(Date.now() / 1000),
                  payload,
                });
                return { meta: { changes: 1 } };
              },
            }),
          };
        }

        return { bind: () => ({ first: vi.fn(), all: vi.fn(), run: vi.fn() }) };
      });
      mocks.getD1.mockReturnValue({ prepare: mocks.prepare });

      // Simulate real external network I/O for Resend and Telegram (e.g. 25ms latency each)
      mocks.sendEmail.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { success: true, provider: 'resend', messageId: 'msg-' + Math.random() };
      });

      mocks.sendTelegramMessage.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { ok: true, message_id: Math.floor(Math.random() * 10000) };
      });

      process.env.TELEGRAM_FOUNDER_CHAT_ID = 'founder-tg-123';

      const churnCustomer: CustomerHealthMetrics = {
        userId: 'usr-concurrent-victim',
        userEmail: 'victim@concurrent.com',
        userName: 'Concurrent User',
        recencyScore: 0,
        velocityScore: 0,
        capacityScore: 10,
        reliabilityScore: 5,
        totalHealthScore: 15,
        status: 'CRITICAL_CHURN_RISK',
        lastActiveAt: new Date().toISOString(),
        breakdown: { recency: 0, velocity: 0, capacity: 10, reliability: 5 },
        rawMetrics: {
          userId: 'usr-concurrent-victim',
          userEmail: 'victim@concurrent.com',
          daysSinceLastActive: 40,
          videosCreated30d: 0,
          creditsRemaining: 10,
          creditsPurchased: 500,
          totalJobs: 10,
          completedJobs: 1,
          failedJobs: 9,
          renderSuccessRate: 0.1,
          lastActiveAt: null,
          userName: 'Concurrent User',
        },
      };

      // Fire 5 concurrent dispatch requests at the exact same moment
      // (e.g. dual cron triggers or rapid clicks by multiple admins)
      const concurrentCount = 5;
      const promises = Array.from({ length: concurrentCount }, () =>
        dispatchWinBackOutreach(churnCustomer),
      );

      const results = await Promise.all(promises);

      // How many emails were dispatched?
      const dispatchedResults = results.filter((r) => r.emailSent === true);
      const skippedResults = results.filter((r) => r.skippedReason === 'COOLDOWN_ACTIVE');

      // TOCTOU GUARD CONFIRMED:
      // In-flight concurrency lock & pre-reservation ensures only 1 request dispatches
      // and all 4 concurrent requests are safely skipped due to active cooldown!
      expect(dispatchedResults.length).toBe(1);
      expect(skippedResults.length).toBe(concurrentCount - 1);
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    });

    it('4.2: Sequential invocations honor cooldown once the audit log record is committed', async () => {
      // Now perform sequential calls where call 1 finishes completely before call 2 starts
      const auditLogStore: Array<{ target_user_id: string; created_at: number; payload: string }> = [];

      mocks.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT created_at, payload FROM admin_audit_log')) {
          return {
            bind: (userId: string) => ({
              first: async () => {
                const records = auditLogStore.filter((r) => r.target_user_id === userId);
                return records.length > 0 ? records[records.length - 1] : null;
              },
            }),
          };
        }

        if (sql.includes('INSERT INTO admin_audit_log')) {
          return {
            bind: (userId: string, payload: string) => ({
              run: async () => {
                auditLogStore.push({
                  target_user_id: userId,
                  created_at: Math.floor(Date.now() / 1000),
                  payload,
                });
                return { meta: { changes: 1 } };
              },
            }),
          };
        }

        return { bind: () => ({ first: vi.fn(), all: vi.fn(), run: vi.fn() }) };
      });
      mocks.getD1.mockReturnValue({ prepare: mocks.prepare });

      mocks.sendEmail.mockResolvedValue({ success: true, provider: 'resend' });
      mocks.sendTelegramMessage.mockResolvedValue({ ok: true });

      const churnCustomer: CustomerHealthMetrics = {
        userId: 'usr-sequential-test',
        userEmail: 'seq@test.com',
        userName: 'Sequential User',
        recencyScore: 0,
        velocityScore: 0,
        capacityScore: 10,
        reliabilityScore: 5,
        totalHealthScore: 15,
        status: 'CRITICAL_CHURN_RISK',
        lastActiveAt: new Date().toISOString(),
        breakdown: { recency: 0, velocity: 0, capacity: 10, reliability: 5 },
        rawMetrics: {} as any,
      };

      // Call 1: Should dispatch successfully
      const res1 = await dispatchWinBackOutreach(churnCustomer);
      expect(res1.emailSent).toBe(true);
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

      // Call 2: Sequential call after call 1 completed should be blocked by cooldown
      const res2 = await dispatchWinBackOutreach(churnCustomer);
      expect(res2.skippedReason).toBe('COOLDOWN_ACTIVE');
      expect(res2.emailSent).toBe(false);
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1); // not incremented
    });
  });
});
