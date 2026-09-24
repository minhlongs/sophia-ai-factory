/**
 * DLQ Routing, Exponential Backoff & Alert Dispatcher Test Suite
 *
 * Validates:
 * - Exponential backoff calculation and cap: delayMs = Math.min(base * 2^retries, max)
 * - Jitter bounds
 * - DLQ routing condition and D1 state update
 * - Message formatting for Telegram bot and incident webhooks
 * - Alert dispatching to Telegram and Webhooks with graceful logger fallback
 *
 * Layer: tree/queue/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  calculateExponentialBackoff,
  shouldRouteToDlq,
  routeJobToDlq,
  formatTelegramDlqMessage,
  formatIncidentWebhookPayload,
  dispatchDlqAlert,
} from '../dlq-alert-dispatcher';
import type { DlqAlertPayload } from '@/seed/types/video-render-queue';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS video_render_jobs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      subaccount_id TEXT,
      lane TEXT NOT NULL DEFAULT 'standard',
      priority_score INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'queued',
      tier TEXT NOT NULL,
      payload TEXT NOT NULL,
      result_url TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      leased_by TEXT,
      leased_until INTEGER,
      provider TEXT,
      dlq_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async run(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: res.changes, duration: 1 },
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        async all(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params);
          return { results, meta: { changes: 0, duration: 1 } };
        },
        async first(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return row ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('DLQ Routing, Backoff & Alert Dispatcher', () => {
  let db: D1Database;
  const mockPayload: DlqAlertPayload = {
    jobId: 'vrj_failed_999',
    orgId: 'org_acme_corp',
    subaccountId: 'sub_marketing',
    tier: 'enterprise',
    lane: 'priority',
    provider: 'fal',
    retryCount: 3,
    maxRetries: 3,
    errorMessage: 'CUDA Out Of Memory during video tensor unflattening',
    dlqReason: 'MAX_RETRIES_EXCEEDED',
    failedAt: 1727170000,
  };

  beforeEach(() => {
    db = createTestD1();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateExponentialBackoff', () => {
    it('calculates expected delays without jitter', () => {
      // baseDelayMs = 1000, maxDelayMs = 60000
      expect(calculateExponentialBackoff(0, 1000, 60000)).toBe(1000); // 1000 * 2^0
      expect(calculateExponentialBackoff(1, 1000, 60000)).toBe(2000); // 1000 * 2^1
      expect(calculateExponentialBackoff(2, 1000, 60000)).toBe(4000); // 1000 * 2^2
      expect(calculateExponentialBackoff(3, 1000, 60000)).toBe(8000); // 1000 * 2^3
      expect(calculateExponentialBackoff(4, 1000, 60000)).toBe(16000); // 1000 * 2^4
    });

    it('caps exponential delay at maxDelayMs', () => {
      expect(calculateExponentialBackoff(10, 1000, 30000)).toBe(30000);
      expect(calculateExponentialBackoff(20, 1000, 60000)).toBe(60000);
    });

    it('handles negative retry counts defensively', () => {
      expect(calculateExponentialBackoff(-2, 1000, 60000)).toBe(1000);
    });

    it('adds jitter within 0-10% bounds when enabled', () => {
      for (let i = 0; i < 10; i++) {
        const withJitter = calculateExponentialBackoff(2, 1000, 60000, true);
        expect(withJitter).toBeGreaterThanOrEqual(4000);
        expect(withJitter).toBeLessThanOrEqual(4400); // 4000 + 10%
      }
    });
  });

  describe('shouldRouteToDlq', () => {
    it('returns true when retryCount reaches or exceeds maxRetries', () => {
      expect(shouldRouteToDlq(3, 3)).toBe(true);
      expect(shouldRouteToDlq(4, 3)).toBe(true);
      expect(shouldRouteToDlq(0, 0)).toBe(true);
    });

    it('returns false when retryCount is strictly less than maxRetries', () => {
      expect(shouldRouteToDlq(0, 3)).toBe(false);
      expect(shouldRouteToDlq(1, 3)).toBe(false);
      expect(shouldRouteToDlq(2, 3)).toBe(false);
    });
  });

  describe('routeJobToDlq', () => {
    it('updates D1 job record to dlq status with reason and clears lease fields', async () => {
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload,
            retry_count, max_retries, leased_by, leased_until, created_at, updated_at
          ) VALUES (?, ?, 'priority', 100, 'leased', 'enterprise', '{}', 3, 3, 'worker_1', ?, ?, ?)`,
        )
        .bind('vrj_to_dlq', 'org_1', now + 60, now, now)
        .run();

      const dlqJob = await routeJobToDlq(db, 'vrj_to_dlq', 'UNRECOVERABLE_GPU_ERROR', 'Model checkpoint missing');

      expect(dlqJob.status).toBe('dlq');
      expect(dlqJob.dlqReason).toBe('UNRECOVERABLE_GPU_ERROR');
      expect(dlqJob.errorMessage).toBe('Model checkpoint missing');
      expect(dlqJob.leasedBy).toBeNull();
      expect(dlqJob.leasedUntil).toBeNull();

      // Verify in DB directly
      const row = await db
        .prepare(`SELECT * FROM video_render_jobs WHERE id = ?`)
        .bind('vrj_to_dlq')
        .first<{ status: string; dlq_reason: string; leased_by: string | null }>();

      expect(row?.status).toBe('dlq');
      expect(row?.dlq_reason).toBe('UNRECOVERABLE_GPU_ERROR');
      expect(row?.leased_by).toBeNull();
    });

    it('throws error when job id does not exist in D1', async () => {
      await expect(routeJobToDlq(db, 'non_existent_id')).rejects.toThrow(/not found/);
    });
  });

  describe('Message Formatting', () => {
    it('formats Telegram HTML message with all diagnostic attributes', () => {
      const msg = formatTelegramDlqMessage(mockPayload);
      expect(msg).toContain('[SOPHIA DLQ ALERT]');
      expect(msg).toContain('<code>vrj_failed_999</code>');
      expect(msg).toContain('<code>org_acme_corp</code>');
      expect(msg).toContain('<code>sub_marketing</code>');
      expect(msg).toContain('ENTERPRISE');
      expect(msg).toContain('PRIORITY');
      expect(msg).toContain('FAL');
      expect(msg).toContain('3 / 3');
      expect(msg).toContain('<code>MAX_RETRIES_EXCEEDED</code>');
      expect(msg).toContain('CUDA Out Of Memory during video tensor unflattening');
    });

    it('formats incident webhook payload properly', () => {
      const webhook = formatIncidentWebhookPayload(mockPayload);
      expect(webhook.event).toBe('video_render_job.dlq');
      expect(webhook.job_id).toBe('vrj_failed_999');
      expect(webhook.severity).toBe('critical');
      expect(webhook.dlq_reason).toBe('MAX_RETRIES_EXCEEDED');
      expect(webhook.error_message).toBe('CUDA Out Of Memory during video tensor unflattening');
    });
  });

  describe('dispatchDlqAlert', () => {
    it('dispatches to Telegram bot and webhook when both are configured', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('telegram.org')) {
          return Promise.resolve({ ok: true, status: 200, text: async () => '{"ok":true}' });
        }
        if (url.includes('betterstack.com')) {
          return Promise.resolve({ ok: true, status: 202, text: async () => '{"received":true}' });
        }
        return Promise.resolve({ ok: true });
      });
      global.fetch = mockFetch;

      const result = await dispatchDlqAlert(mockPayload, {
        telegramBotToken: 'mock_token_123',
        telegramChatId: 'chat_456',
        incidentWebhookUrl: 'https://in.betterstack.com/incidents/789',
      });

      expect(result.telegramSent).toBe(true);
      expect(result.webhookSent).toBe(true);
      expect(result.loggedFallback).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('falls back safely to logger when credentials are not configured', async () => {
      const originalEnv = { ...process.env };
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      delete process.env.BETTER_STACK_INCIDENT_WEBHOOK_URL;
      delete process.env.INCIDENT_WEBHOOK_URL;

      const result = await dispatchDlqAlert(mockPayload, {});

      expect(result.telegramSent).toBe(false);
      expect(result.webhookSent).toBe(false);
      expect(result.loggedFallback).toBe(true);
      expect(result.errors?.length).toBe(0);

      process.env = originalEnv;
    });

    it('handles network errors gracefully without throwing', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline or DNS error'));

      const result = await dispatchDlqAlert(mockPayload, {
        telegramBotToken: 'tok',
        telegramChatId: 'chat',
        incidentWebhookUrl: 'https://incident.endpoint',
      });

      expect(result.telegramSent).toBe(false);
      expect(result.webhookSent).toBe(false);
      expect(result.loggedFallback).toBe(true);
      expect(result.errors?.length).toBe(2);
      expect(result.errors?.[0]).toContain('Telegram exception');
      expect(result.errors?.[1]).toContain('Webhook exception');
    });
  });
});
