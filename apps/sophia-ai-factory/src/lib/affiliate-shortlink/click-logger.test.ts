/**
 * Tests for click-logger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./ip-hash', () => ({
  hashIp: vi.fn().mockResolvedValue('a'.repeat(64)),
  getDailySalt: vi.fn().mockReturnValue('test-salt'),
}));

import { logClick } from './click-logger';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockDb = { from: mockFrom };

describe('logClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockReturnValue(mockDb as ReturnType<typeof createServerClient>);
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });

  const baseParams = {
    clickId: 'test-click-id-123',
    campaignId: 'campaign-abc',
    userId: 'user-xyz',
    offerId: 'phenq',
    shortCode: 'abc123def',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    referer: 'https://youtube.com',
    country: 'US',
  };

  it('fires without throwing', () => {
    expect(() => logClick(baseParams)).not.toThrow();
  });

  it('returns void synchronously (fire-and-forget)', () => {
    const result = logClick(baseParams);
    expect(result).toBeUndefined();
  });

  it('inserts into affiliate_clicks with correct fields', async () => {
    logClick(baseParams);
    // Allow microtask queue to flush
    await new Promise(r => setTimeout(r, 10));

    expect(mockFrom).toHaveBeenCalledWith('affiliate_clicks');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      click_id: 'test-click-id-123',
      campaign_id: 'campaign-abc',
      user_id: 'user-xyz',
      offer_id: 'phenq',
      short_code: 'abc123def',
      user_agent: 'Mozilla/5.0',
      referer: 'https://youtube.com',
      country: 'US',
    }));
  });

  it('hashes IP — does not store raw IP', async () => {
    logClick(baseParams);
    await new Promise(r => setTimeout(r, 10));

    const insertCall = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    // ip_hash should be present, ip should not
    expect(insertCall?.ip_hash).toBeDefined();
    expect(insertCall?.ip).toBeUndefined();
    // ip_hash should not be the raw IP
    expect(insertCall?.ip_hash).not.toBe('192.168.1.1');
  });

  it('handles null IP gracefully', async () => {
    logClick({ ...baseParams, ip: null });
    await new Promise(r => setTimeout(r, 10));

    const insertCall = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertCall?.ip_hash).toBeNull();
  });

  it('logs warning on D1 insert error — does not throw', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'constraint violation' } });

    expect(() => logClick(baseParams)).not.toThrow();
    await new Promise(r => setTimeout(r, 10));

    expect(logger.warn).toHaveBeenCalledWith(
      'affiliate_click_insert_failed',
      expect.objectContaining({ clickId: 'test-click-id-123' })
    );
  });

  it('logs warning on unexpected exception — does not throw', async () => {
    vi.mocked(createServerClient).mockImplementationOnce(() => {
      throw new Error('DB binding not available');
    });

    expect(() => logClick(baseParams)).not.toThrow();
    await new Promise(r => setTimeout(r, 10));

    expect(logger.warn).toHaveBeenCalledWith(
      'affiliate_click_logger_error',
      expect.objectContaining({ clickId: 'test-click-id-123' })
    );
  });
});
