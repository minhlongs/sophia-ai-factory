import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  executeFounderIntervention,
  getRetentionSummaryStats,
  escapeHtml,
  escapeTelegramMarkdown,
  CHURN_HEALTH_THRESHOLD,
  WARNING_HEALTH_THRESHOLD,
  WINBACK_COOLDOWN_MS,
} from '../customer-retention-service';

describe('Customer Retention Service & Anti-Churn AI Guardian', () => {
  const initialEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getD1.mockReturnValue({ prepare: mocks.prepare });
    mocks.getBalance.mockResolvedValue({
      credits_remaining: 100,
      credits_total_purchased: 100,
      credits_total_used: 0,
    });
  });

  afterEach(() => {
    process.env = { ...initialEnv };
  });

  describe('1. 4-Factor Scoring Engine Unit Tests', () => {
    describe('Recency Score (0 - 25)', () => {
      it('awards 25 points for active within 1 day', () => {
        expect(calculateRecencyScore(0)).toBe(25);
        expect(calculateRecencyScore(0.5)).toBe(25);
        expect(calculateRecencyScore(1)).toBe(25);
        expect(calculateRecencyScore(-1)).toBe(25); // just active
      });

      it('awards 20 points for active within 3 days', () => {
        expect(calculateRecencyScore(1.5)).toBe(20);
        expect(calculateRecencyScore(3)).toBe(20);
      });

      it('awards 15 points for active within 7 days', () => {
        expect(calculateRecencyScore(4)).toBe(15);
        expect(calculateRecencyScore(7)).toBe(15);
      });

      it('awards 10 points for active within 14 days', () => {
        expect(calculateRecencyScore(8)).toBe(10);
        expect(calculateRecencyScore(14)).toBe(10);
      });

      it('awards 5 points for active within 30 days', () => {
        expect(calculateRecencyScore(15)).toBe(5);
        expect(calculateRecencyScore(30)).toBe(5);
      });

      it('awards 0 points for inactive beyond 30 days', () => {
        expect(calculateRecencyScore(31)).toBe(0);
        expect(calculateRecencyScore(60)).toBe(0);
        expect(calculateRecencyScore(100)).toBe(0);
      });
    });

    describe('Velocity Score (0 - 25)', () => {
      it('awards 25 points for >= 10 videos in past 30 days', () => {
        expect(calculateVelocityScore(10)).toBe(25);
        expect(calculateVelocityScore(25)).toBe(25);
      });

      it('awards 20 points for 5 to 9 videos', () => {
        expect(calculateVelocityScore(5)).toBe(20);
        expect(calculateVelocityScore(9)).toBe(20);
      });

      it('awards 15 points for 2 to 4 videos', () => {
        expect(calculateVelocityScore(2)).toBe(15);
        expect(calculateVelocityScore(4)).toBe(15);
      });

      it('awards 10 points for 1 video', () => {
        expect(calculateVelocityScore(1)).toBe(10);
      });

      it('awards 0 points for 0 videos', () => {
        expect(calculateVelocityScore(0)).toBe(0);
      });
    });

    describe('Capacity Score (0 - 25)', () => {
      it('scores capacity correctly with purchased credits ratio', () => {
        // ratio >= 0.5 -> 25
        expect(calculateCapacityScore(500, 1000)).toBe(25);
        expect(calculateCapacityScore(800, 1000)).toBe(25);

        // ratio >= 0.2 -> 20
        expect(calculateCapacityScore(250, 1000)).toBe(20);

        // ratio >= 0.1 -> 15
        expect(calculateCapacityScore(150, 1000)).toBe(15);

        // remaining > 0 -> 10
        expect(calculateCapacityScore(50, 1000)).toBe(10);

        // remaining == 0 -> 0 (critical capacity exhaustion)
        expect(calculateCapacityScore(0, 1000)).toBe(0);
      });

      it('scores capacity correctly without purchased credits (initial or free)', () => {
        expect(calculateCapacityScore(600, 0)).toBe(25);
        expect(calculateCapacityScore(250, 0)).toBe(20);
        expect(calculateCapacityScore(120, 0)).toBe(15);
        expect(calculateCapacityScore(30, 0)).toBe(10);
        expect(calculateCapacityScore(0, 0)).toBe(0);
      });
    });

    describe('Reliability Score (0 - 25)', () => {
      it('awards 20 points baseline when no jobs have run yet', () => {
        expect(calculateReliabilityScore(0, 0)).toBe(20);
      });

      it('awards 25 points for >= 95% render success', () => {
        expect(calculateReliabilityScore(100, 0)).toBe(25);
        expect(calculateReliabilityScore(95, 5)).toBe(25);
      });

      it('awards 20 points for 85% to 94% render success', () => {
        expect(calculateReliabilityScore(90, 10)).toBe(20);
        expect(calculateReliabilityScore(85, 15)).toBe(20);
      });

      it('awards 15 points for 70% to 84% render success', () => {
        expect(calculateReliabilityScore(75, 25)).toBe(15);
        expect(calculateReliabilityScore(70, 30)).toBe(15);
      });

      it('awards 10 points for 50% to 69% render success', () => {
        expect(calculateReliabilityScore(60, 40)).toBe(10);
        expect(calculateReliabilityScore(50, 50)).toBe(10);
      });

      it('awards 5 points for < 50% render success', () => {
        expect(calculateReliabilityScore(30, 70)).toBe(5);
        expect(calculateReliabilityScore(0, 10)).toBe(5);
      });
    });
  });

  describe('2. computeCustomerHealth & Churn Threshold Engine', () => {
    it('computes HEALTHY status (>= 70) for high-performing client', () => {
      const raw: RawCustomerActivityMetrics = {
        userId: 'usr-healthy-1',
        userEmail: 'vip@agency.io',
        userName: 'VIP Agency',
        lastActiveAt: new Date().toISOString(),
        daysSinceLastActive: 1, // recency = 25
        videosCreated30d: 12, // velocity = 25
        creditsRemaining: 600,
        creditsPurchased: 1000, // capacity = 25 (ratio 0.6)
        totalJobs: 20,
        completedJobs: 20,
        failedJobs: 0, // reliability = 25 (100%)
        renderSuccessRate: 1.0,
      };

      const health = computeCustomerHealth(raw);
      expect(health.totalHealthScore).toBe(100);
      expect(health.status).toBe('HEALTHY');
      expect(health.breakdown).toEqual({
        recency: 25,
        velocity: 25,
        capacity: 25,
        reliability: 25,
      });
    });

    it('computes WARNING status (40 to 69) for slowing client', () => {
      const raw: RawCustomerActivityMetrics = {
        userId: 'usr-warn-1',
        userEmail: 'warning@client.com',
        userName: 'Slowing Client',
        lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        daysSinceLastActive: 5, // recency = 15
        videosCreated30d: 3, // velocity = 15
        creditsRemaining: 150,
        creditsPurchased: 1000, // capacity = 15 (ratio 0.15)
        totalJobs: 10,
        completedJobs: 7,
        failedJobs: 3, // reliability = 15 (70%)
        renderSuccessRate: 0.7,
      };

      const health = computeCustomerHealth(raw);
      expect(health.totalHealthScore).toBe(60);
      expect(health.status).toBe('WARNING');
    });

    it('computes CRITICAL_CHURN_RISK status (< 40) for inactive, depleted, failing client', () => {
      const raw: RawCustomerActivityMetrics = {
        userId: 'usr-churn-1',
        userEmail: 'churn@risk.com',
        userName: 'At Risk User',
        lastActiveAt: new Date(Date.now() - 40 * 86400000).toISOString(),
        daysSinceLastActive: 40, // recency = 0
        videosCreated30d: 0, // velocity = 0
        creditsRemaining: 0,
        creditsPurchased: 1000, // capacity = 0
        totalJobs: 5,
        completedJobs: 1,
        failedJobs: 4, // reliability = 5 (< 50%)
        renderSuccessRate: 0.2,
      };

      const health = computeCustomerHealth(raw);
      expect(health.totalHealthScore).toBe(5);
      expect(health.status).toBe('CRITICAL_CHURN_RISK');
      expect(health.totalHealthScore).toBeLessThan(CHURN_HEALTH_THRESHOLD);
    });

    it('validates exact threshold boundary transitions', () => {
      const baseRaw: RawCustomerActivityMetrics = {
        userId: 'usr-boundary',
        userEmail: 'boundary@test.com',
        userName: 'Boundary Tester',
        lastActiveAt: null,
        daysSinceLastActive: 30, // recency = 5
        videosCreated30d: 1, // velocity = 10
        creditsRemaining: 50,
        creditsPurchased: 1000, // capacity = 10
        totalJobs: 4,
        completedJobs: 2,
        failedJobs: 2, // reliability = 10 (50%)
        renderSuccessRate: 0.5,
      };

      // 5 + 10 + 10 + 10 = 35 -> CRITICAL_CHURN_RISK
      const r35 = computeCustomerHealth(baseRaw);
      expect(r35.totalHealthScore).toBe(35);
      expect(r35.status).toBe('CRITICAL_CHURN_RISK');

      // Add 5 points (recency = 10 -> total 40) -> WARNING
      const r40 = computeCustomerHealth({ ...baseRaw, daysSinceLastActive: 10 });
      expect(r40.totalHealthScore).toBe(40);
      expect(r40.status).toBe('WARNING');

      // Total 69 -> WARNING
      // (recency 20 + velocity 20 + capacity 15 + reliability 14? Let's tune: 20 + 20 + 15 + 14 is not discrete)
      // Recency 20 (<=3d) + Velocity 20 (5 vid) + Capacity 15 (ratio 0.15) + Reliability 15 (70%) = 70 -> HEALTHY
      const r70 = computeCustomerHealth({
        ...baseRaw,
        daysSinceLastActive: 3, // 20
        videosCreated30d: 5, // 20
        creditsRemaining: 150, // 15
        completedJobs: 7,
        failedJobs: 3, // 15
      });
      expect(r70.totalHealthScore).toBe(70);
      expect(r70.status).toBe('HEALTHY');
    });
  });

  describe('3. Anti-Spam Cooldown Protection', () => {
    it('returns inCooldown: false when no prior win-back outreach exists', async () => {
      const first = vi.fn().mockResolvedValue(null);
      const bind = vi.fn().mockReturnValue({ first });
      mocks.prepare.mockReturnValue({ bind });

      const result = await checkWinBackCooldown('user-virgin');
      expect(result.inCooldown).toBe(false);
      expect(result.lastWinBackAt).toBeUndefined();
    });

    it('returns inCooldown: true when outreach was dispatched within 7 days', async () => {
      const recentTimestampSec = Math.floor((Date.now() - 2 * 86400000) / 1000);
      const first = vi.fn().mockResolvedValue({ created_at: recentTimestampSec, payload: '{}' });
      const bind = vi.fn().mockReturnValue({ first });
      mocks.prepare.mockReturnValue({ bind });

      const result = await checkWinBackCooldown('user-cooldown');
      expect(result.inCooldown).toBe(true);
      expect(result.lastWinBackAt).toBeDefined();
    });

    it('returns inCooldown: false when outreach occurred > 7 days ago', async () => {
      const oldTimestampSec = Math.floor((Date.now() - 10 * 86400000) / 1000);
      const first = vi.fn().mockResolvedValue({ created_at: oldTimestampSec, payload: '{}' });
      const bind = vi.fn().mockReturnValue({ first });
      mocks.prepare.mockReturnValue({ bind });

      const result = await checkWinBackCooldown('user-expired-cooldown');
      expect(result.inCooldown).toBe(false);
    });
  });

  describe('4. Automated Win-Back Dispatcher', () => {
    it('skips dispatch with NOT_AT_RISK when health score >= 40', async () => {
      const healthyCustomer: CustomerHealthMetrics = {
        userId: 'usr-safe',
        userEmail: 'safe@test.com',
        recencyScore: 20,
        velocityScore: 20,
        capacityScore: 20,
        reliabilityScore: 20,
        totalHealthScore: 80,
        status: 'HEALTHY',
        lastActiveAt: new Date().toISOString(),
        breakdown: { recency: 20, velocity: 20, capacity: 20, reliability: 20 },
        rawMetrics: {} as any,
      };

      const result = await dispatchWinBackOutreach(healthyCustomer);
      expect(result.skippedReason).toBe('NOT_AT_RISK');
      expect(result.emailSent).toBe(false);
      expect(result.telegramNotified).toBe(false);
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('skips dispatch with COOLDOWN_ACTIVE when client is in 7-day cooldown', async () => {
      // Mock cooldown check returning true
      const recentTimestampSec = Math.floor((Date.now() - 3 * 86400000) / 1000);
      const first = vi.fn().mockResolvedValue({ created_at: recentTimestampSec, payload: '{}' });
      const bind = vi.fn().mockReturnValue({ first });
      mocks.prepare.mockReturnValue({ bind });

      const atRiskCustomer: CustomerHealthMetrics = {
        userId: 'usr-at-risk-1',
        userEmail: 'atrisk@test.com',
        recencyScore: 5,
        velocityScore: 0,
        capacityScore: 10,
        reliabilityScore: 10,
        totalHealthScore: 25,
        status: 'CRITICAL_CHURN_RISK',
        lastActiveAt: new Date().toISOString(),
        breakdown: { recency: 5, velocity: 0, capacity: 10, reliability: 10 },
        rawMetrics: {
          userId: 'usr-at-risk-1',
          userEmail: 'atrisk@test.com',
          daysSinceLastActive: 25,
          videosCreated30d: 0,
          creditsRemaining: 20,
          creditsPurchased: 500,
          totalJobs: 5,
          completedJobs: 2,
          failedJobs: 3,
          renderSuccessRate: 0.4,
          lastActiveAt: null,
          userName: null,
        },
      };

      const result = await dispatchWinBackOutreach(atRiskCustomer);
      expect(result.skippedReason).toBe('COOLDOWN_ACTIVE');
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('dispatches Resend email & Telegram alert and records audit log when health < 40 and not in cooldown', async () => {
      // 1. Mock cooldown query -> null (not in cooldown)
      const first = vi.fn().mockResolvedValue(null);
      const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const bind = vi.fn().mockImplementation(() => ({ first, run }));
      mocks.prepare.mockReturnValue({ bind });

      mocks.sendEmail.mockResolvedValue({ success: true, provider: 'resend', messageId: 'msg-123' });
      mocks.sendTelegramMessage.mockResolvedValue({ ok: true, message_id: 456 });

      process.env.TELEGRAM_FOUNDER_CHAT_ID = 'chat-founder-99';

      const atRiskCustomer: CustomerHealthMetrics = {
        userId: 'usr-churn-target',
        userEmail: 'target@churn.com',
        userName: 'Target Client',
        recencyScore: 0,
        velocityScore: 0,
        capacityScore: 10,
        reliabilityScore: 10,
        totalHealthScore: 20,
        status: 'CRITICAL_CHURN_RISK',
        lastActiveAt: new Date().toISOString(),
        breakdown: { recency: 0, velocity: 0, capacity: 10, reliability: 10 },
        rawMetrics: {
          userId: 'usr-churn-target',
          userEmail: 'target@churn.com',
          daysSinceLastActive: 35,
          videosCreated30d: 0,
          creditsRemaining: 10,
          creditsPurchased: 500,
          totalJobs: 2,
          completedJobs: 1,
          failedJobs: 1,
          renderSuccessRate: 0.5,
          lastActiveAt: null,
          userName: 'Target Client',
        },
      };

      const result = await dispatchWinBackOutreach(atRiskCustomer);

      expect(result.emailSent).toBe(true);
      expect(result.telegramNotified).toBe(true);
      expect(result.healthScore).toBe(20);

      // Verify email parameters
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'target@churn.com',
          subject: expect.stringContaining('Sophia AI'),
        }),
      );

      // Verify telegram parameters
      expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
        'chat-founder-99',
        expect.stringContaining('ANTI-CHURN GUARDIAN'),
      );

      // Verify audit log record
      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
      );
    });
  });

  describe('5. 1-Click Founder Intervention', () => {
    it('executes atomic credit grant, sends personal email, alerts telegram, and logs audit', async () => {
      // Mock D1 user lookup for getCustomerHealthMetrics
      const userRow = {
        id: 'usr-founder-target',
        email: 'saved@customer.com',
        name: 'Saved Customer',
        createdAt: new Date().toISOString(),
      };

      const first = vi.fn()
        .mockResolvedValueOnce(userRow) // user lookup
        .mockResolvedValueOnce(null) // session
        .mockResolvedValueOnce(null) // streak
        .mockResolvedValueOnce({ cnt: 0 }) // videos
        .mockResolvedValueOnce(null) // cooldown check
        // second lookup for updatedCustomer:
        .mockResolvedValueOnce(userRow)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ cnt: 0 })
        .mockResolvedValueOnce(null);

      const all = vi.fn().mockResolvedValue({ results: [] });
      const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const bind = vi.fn().mockReturnValue({ first, all, run });
      mocks.prepare.mockReturnValue({ bind });

      mocks.getBalance.mockResolvedValue({
        credits_remaining: 500,
        credits_total_purchased: 500,
        credits_total_used: 0,
      });

      mocks.addCredits.mockResolvedValue(true);
      mocks.sendEmail.mockResolvedValue({ success: true, provider: 'resend' });
      mocks.sendTelegramMessage.mockResolvedValue({ ok: true });

      process.env.TELEGRAM_ADMIN_CHAT_ID = 'admin-tg-100';

      const result = await executeFounderIntervention({
        userId: 'usr-founder-target',
        bonusCredits: 1000,
        customMessage: 'Here is a special 1,000 MCU gift from Sophia Founder!',
        notifyEmail: true,
        notifyTelegram: true,
        actorUserId: 'admin-super-1',
      });

      expect(result.success).toBe(true);
      expect(result.creditsAdded).toBe(1000);
      expect(result.emailSent).toBe(true);
      expect(result.telegramNotified).toBe(true);

      // Verify credits addition call
      expect(mocks.addCredits).toHaveBeenCalledWith(
        'usr-founder-target',
        1000,
        'FOUNDER_WINBACK_BONUS',
        expect.objectContaining({
          customMessage: 'Here is a special 1,000 MCU gift from Sophia Founder!',
        }),
      );

      // Verify email send call
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'saved@customer.com',
          subject: expect.stringContaining('Founder'),
        }),
      );

      // Verify telegram notification
      expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
        'admin-tg-100',
        expect.stringContaining('FOUNDER ACTION EXECUTED'),
      );
    });

    it('returns error when target user does not exist', async () => {
      const first = vi.fn().mockResolvedValue(null);
      const bind = vi.fn().mockReturnValue({ first });
      mocks.prepare.mockReturnValue({ bind });

      const result = await executeFounderIntervention({
        userId: 'non-existent-user',
        bonusCredits: 500,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Customer not found');
      expect(mocks.addCredits).not.toHaveBeenCalled();
    });
  });

  describe('6. Remediation & Edge Case Hardening (M1)', () => {
    it('escapes HTML entities properly to neutralize XSS in email templates', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
      );
      expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
      expect(escapeHtml('Safe text 123')).toBe('Safe text 123');
    });

    it('escapes Telegram Markdown special characters properly', () => {
      expect(escapeTelegramMarkdown('')).toBe('');
      expect(escapeTelegramMarkdown('promo_discount_2026*code*[test]`var`\\slash')).toBe(
        'promo\\_discount\\_2026\\*code\\*\\[test\\]\\`var\\`\\\\slash',
      );
    });

    it('returns 0 for NaN or non-finite credits in calculateCapacityScore', () => {
      expect(calculateCapacityScore(NaN, 1000)).toBe(0);
      expect(calculateCapacityScore(NaN, 0)).toBe(0);
      expect(calculateCapacityScore(-Infinity, 1000)).toBe(0);
    });

    it('computeCustomerHealth guards against RangeError and classifies NaN score as CRITICAL_CHURN_RISK', () => {
      const rawCorrupted: RawCustomerActivityMetrics = {
        userId: 'usr-corrupted-health',
        userEmail: 'corrupt@risk.com',
        userName: null,
        lastActiveAt: null,
        daysSinceLastActive: NaN,
        videosCreated30d: NaN,
        creditsRemaining: NaN,
        creditsPurchased: NaN,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        renderSuccessRate: 0,
      };

      expect(() => computeCustomerHealth(rawCorrupted)).not.toThrow();
      const health = computeCustomerHealth(rawCorrupted);
      expect(health.status).toBe('CRITICAL_CHURN_RISK');
      expect(health.totalHealthScore).toBe(20);
      expect(health.lastActiveAt).toBeDefined();
    });

    it('executeFounderIntervention escapes malicious customMessage in outbound email HTML', async () => {
      const userRow = {
        id: 'usr-xss-target',
        email: 'user@victim.com',
        name: '<script>alert(1)</script>',
        createdAt: new Date().toISOString(),
      };
      const first = vi.fn().mockResolvedValue(userRow);
      const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const bind = vi.fn().mockImplementation(() => ({ first, run }));
      mocks.prepare.mockReturnValue({ bind });

      mocks.getBalance.mockResolvedValue({
        credits_remaining: 100,
        credits_total_purchased: 100,
        credits_total_used: 0,
      });

      mocks.addCredits.mockResolvedValue(true);
      mocks.sendEmail.mockResolvedValue({ success: true, messageId: 'msg-sec-1' });

      await executeFounderIntervention({
        userId: 'usr-xss-target',
        customMessage: '<img src=x onerror=alert(2)>Hello "world"',
        notifyEmail: true,
        notifyTelegram: false,
      });

      expect(mocks.sendEmail).toHaveBeenCalled();
      const emailArgs = mocks.sendEmail.mock.calls[0][0] as { html: string };
      expect(emailArgs.html).not.toContain('<img src=x onerror=alert(2)>');
      expect(emailArgs.html).toContain('&lt;img src=x onerror=alert(2)&gt;Hello &quot;world&quot;');
      expect(emailArgs.html).not.toContain('<script>alert(1)</script>');
      expect(emailArgs.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
