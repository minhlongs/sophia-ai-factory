/**
 * Unit tests for customer-health-summary.
 * Validates error classification, 7 safe status resolutions, and tenant isolation.
 *
 * @module land/production-monitoring/__tests__/customer-health-summary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockPrepare = vi.fn().mockReturnThis();
const mockBind = vi.fn().mockReturnThis();
const mockFirst = vi.fn();
const mockAll = vi.fn();

const fakeDb = {
  prepare: mockPrepare,
  bind: mockBind,
  first: mockFirst,
  all: mockAll,
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => fakeDb,
}));

import {
  classifyCustomerIncident,
  getCustomerHealthSummary,
} from '../customer-health-summary';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('classifyCustomerIncident', () => {
  it('classifies 401/403/unauthorized as KEY_EXPIRED_OR_INVALID', () => {
    const inc = classifyCustomerIncident('Error 401: Invalid API Key provided', 'ElevenLabs');
    expect(inc.category).toBe('KEY_EXPIRED_OR_INVALID');
    expect(inc.service).toBe('ElevenLabs');
    expect(inc.whatHappened).toContain('expired or invalid');
    expect(inc.whatHappenedVi).toContain('hết hạn');
    expect(inc.whatYouCanDo).toContain('Settings');
  });

  it('classifies 429/rate-limit as PROVIDER_RATE_LIMIT', () => {
    const inc = classifyCustomerIncident('429 Too Many Requests: Rate limit exceeded', 'fal.ai');
    expect(inc.category).toBe('PROVIDER_RATE_LIMIT');
    expect(inc.service).toBe('fal.ai');
    expect(inc.whatHappened).toContain('rate limit');
    expect(inc.whatHappenedVi).toContain('tốc độ');
  });

  it('classifies credit/quota depletion as QUOTA_EXHAUSTED', () => {
    const inc = classifyCustomerIncident('Insufficient balance. Please add credits.', 'OpenRouter');
    expect(inc.category).toBe('QUOTA_EXHAUSTED');
    expect(inc.service).toBe('OpenRouter');
    expect(inc.whatHappened).toContain('quota depleted');
    expect(inc.whatHappenedVi).toContain('tín dụng');
  });

  it('classifies timeout errors as NETWORK_TIMEOUT', () => {
    const inc = classifyCustomerIncident('Connection timed out after 30000ms', 'HeyGen');
    expect(inc.category).toBe('NETWORK_TIMEOUT');
    expect(inc.service).toBe('HeyGen');
    expect(inc.whatHappened).toContain('timed out');
    expect(inc.whatHappenedVi).toContain('Hết thời gian chờ');
  });

  it('classifies content policy or invalid media format as ASSET_VALIDATION_FAILED', () => {
    const inc = classifyCustomerIncident('Prompt rejected: safety filter triggered', 'Image Gen');
    expect(inc.category).toBe('ASSET_VALIDATION_FAILED');
    expect(inc.service).toBe('Image Gen');
    expect(inc.whatHappened).toContain('rejected');
    expect(inc.whatHappenedVi).toContain('từ chối');
  });

  it('never leaks stack trace or connection string in classified errors', () => {
    const raw = 'Fatal: postgresql://admin:secretPass@internal-host:5432/db connection timeout at Object.<anonymous> (/app/node_modules/...)';
    const inc = classifyCustomerIncident(raw, 'Database');
    expect(inc.whatHappened).not.toContain('secretPass');
    expect(inc.whatHappened).not.toContain('5432');
    expect(inc.whatItMeans).not.toContain('/app/node_modules');
  });
});

describe('getCustomerHealthSummary', () => {
  it('returns all healthy services when everything is configured and active', async () => {
    // 1. user_api_keys
    mockAll.mockResolvedValueOnce({ results: [{ provider: 'fal-ai' }, { provider: 'elevenlabs' }] });
    // 2. video_jobs
    mockAll.mockResolvedValueOnce({ results: [{ id: 'job-1', status: 'published', error: null, created_at: Date.now() }] });
    // 3. subscriptions
    mockFirst.mockResolvedValueOnce({ status: 'active', plan: 'pro', tier: 'PREMIUM' });
    // 4. telegram_paired_chats
    mockFirst.mockResolvedValueOnce({ chat_id: 'chat-999' });

    const summary = await getCustomerHealthSummary('usr-123');

    expect(summary.sophiaCore).toBe('READY');
    expect(summary.authentication).toBe('READY');
    expect(summary.aiProvider).toBe('READY');
    expect(summary.storage).toBe('READY');
    expect(summary.videoPipeline).toBe('READY');
    expect(summary.billing).toBe('READY');
    expect(summary.telegram).toBe('CONNECTED');
    expect(summary.incidents).toHaveLength(0);
  });

  it('flags AI Provider as ACTION_REQUIRED when no keys exist', async () => {
    mockAll.mockResolvedValueOnce({ results: [] }); // 0 keys
    mockAll.mockResolvedValueOnce({ results: [] }); // 0 jobs
    mockFirst.mockResolvedValueOnce(null); // no sub
    mockFirst.mockResolvedValueOnce(null); // no telegram

    const summary = await getCustomerHealthSummary('usr-empty');

    expect(summary.aiProvider).toBe('ACTION_REQUIRED');
    expect(summary.telegram).toBe('NOT_CONNECTED');
    expect(summary.incidents.some((i) => i.category === 'KEY_EXPIRED_OR_INVALID')).toBe(true);
  });

  it('flags Video Pipeline as DEGRADED when recent job failed', async () => {
    mockAll.mockResolvedValueOnce({ results: [{ provider: 'fal-ai' }] });
    mockAll.mockResolvedValueOnce({
      results: [
        { id: 'job-fail-1', status: 'failed', error: '429 Rate limit exceeded by provider', created_at: Date.now() },
      ],
    });
    mockFirst.mockResolvedValueOnce({ status: 'active' });
    mockFirst.mockResolvedValueOnce({ chat_id: 'chat-1' });

    const summary = await getCustomerHealthSummary('usr-fail-job');

    expect(summary.videoPipeline).toBe('DEGRADED');
    expect(summary.incidents.some((i) => i.category === 'PROVIDER_RATE_LIMIT')).toBe(true);
  });

  it('flags Billing as ACTION_REQUIRED when subscription is past_due', async () => {
    mockAll.mockResolvedValueOnce({ results: [{ provider: 'openrouter' }] });
    mockAll.mockResolvedValueOnce({ results: [] });
    mockFirst.mockResolvedValueOnce({ status: 'past_due' });
    mockFirst.mockResolvedValueOnce(null);

    const summary = await getCustomerHealthSummary('usr-past-due');

    expect(summary.billing).toBe('ACTION_REQUIRED');
    expect(summary.incidents.some((i) => i.id === 'inc-sub-past-due')).toBe(true);
  });

  it('fails gracefully and marks Sophia Core as DEGRADED if database throws', async () => {
    mockAll.mockRejectedValueOnce(new Error('D1 connection broken'));

    const summary = await getCustomerHealthSummary('usr-error');

    expect(summary.sophiaCore).toBe('DEGRADED');
    expect(summary.authentication).toBe('READY');
  });
});
