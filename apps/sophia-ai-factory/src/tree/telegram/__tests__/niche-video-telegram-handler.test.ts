/**
 * Niche Video Telegram Handler Vitest Suite
 *
 * Verifies parsing of commands, compliance pre-checks,
 * and Inngest event dispatching.
 *
 * @module tree/telegram/__tests__/niche-video-telegram-handler.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseNicheVideoCommand,
  handleNicheVideoTelegramCommand,
} from '../niche-video-telegram-handler';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_123'] }),
  },
}));

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Niche Video Telegram Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseNicheVideoCommand', () => {
    it('correctly identifies SaaS product from URL', () => {
      const parsed = parseNicheVideoCommand('/saas_video', 'https://linear.app');
      expect(parsed.niche).toBe('saas_global');
      expect(parsed.productName).toBe('Linear');
      expect(parsed.blueprintId).toBe('saas_problem_agitation_solution');
    });

    it('correctly identifies Crypto exchange from command', () => {
      const parsed = parseNicheVideoCommand('/crypto_video', 'binance');
      expect(parsed.niche).toBe('crypto_global');
      expect(parsed.blueprintId).toBe('crypto_fee_discount_signup_bonus');
    });

    it('auto-detects crypto keywords in generic /niche_video command', () => {
      const parsed = parseNicheVideoCommand('/niche_video', 'https://bybit.com/trade');
      expect(parsed.niche).toBe('crypto_global');
      expect(parsed.productName).toBe('Bybit');
    });
  });

  describe('handleNicheVideoTelegramCommand', () => {
    it('returns guidance when arguments are missing', async () => {
      const result = await handleNicheVideoTelegramCommand('12345', '/niche_video', '');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('MISSING_ARGUMENTS');
    });

    it('dispatches SaaS campaign to Inngest successfully', async () => {
      const result = await handleNicheVideoTelegramCommand(
        '12345',
        '/saas_video',
        'https://hubspot.com',
        'usr_tg_test',
      );
      expect(result.ok).toBe(true);
      expect(result.niche).toBe('saas_global');
      expect(result.productName).toBe('Hubspot');
    });

    it('dispatches Crypto campaign to Inngest successfully', async () => {
      const result = await handleNicheVideoTelegramCommand(
        '12345',
        '/crypto_video',
        'Binance',
        'usr_tg_test',
      );
      expect(result.ok).toBe(true);
      expect(result.niche).toBe('crypto_global');
    });
  });
});
