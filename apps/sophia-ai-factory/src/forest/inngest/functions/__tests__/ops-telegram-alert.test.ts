/**
 * Tests for ops-telegram-alert Inngest function.
 *
 * Verifies:
 * - Bilingual message formatting for AUTH_FAILURE and RATE_LIMIT
 * - Safe handling when bot token or chat ID is missing (fail-safe)
 * - Successful Telegram dispatch when configured
 * - Error handling when Telegram client fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatOpsAlertMessage,
  processOpsAlert,
} from '../ops-telegram-alert';

const sendTelegramMessageMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerInfoMock = vi.fn();

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    info: (...args: unknown[]) => loggerInfoMock(...args),
    error: vi.fn(),
  },
}));

describe('opsTelegramAlert function', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    sendTelegramMessageMock.mockReset();
    loggerWarnMock.mockReset();
    loggerInfoMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('formatOpsAlertMessage', () => {
    it('formats bilingual alert for AUTH_FAILURE with default text', () => {
      const msg = formatOpsAlertMessage({
        provider: 'fal-ai',
        failureKind: 'AUTH_FAILURE',
      });

      expect(msg).toContain('⚠️ Sophia Ops Alert / Cảnh báo vận hành');
      expect(msg).toContain('Provider / Nhà cung cấp: fal-ai');
      expect(msg).toContain('API Key Expired or Invalid (AUTH_FAILURE)');
      expect(msg).toContain('Khóa API không hợp lệ hoặc hết hạn');
      expect(msg).toContain('Creative Mission execution paused');
      expect(msg).toContain('Update API key in Setup Wizard: /vi/setup');
      expect(msg).toContain('/vi/setup');
    });

    it('formats bilingual alert for RATE_LIMIT with default text', () => {
      const msg = formatOpsAlertMessage({
        provider: 'openrouter',
        failureKind: 'RATE_LIMIT',
      });

      expect(msg).toContain('Provider / Nhà cung cấp: openrouter');
      expect(msg).toContain('RATE_LIMIT');
      expect(msg).toContain('Check provider quota & retry');
    });

    it('honors custom reason, impact, and action overrides', () => {
      const msg = formatOpsAlertMessage({
        provider: 'replicate',
        failureKind: 'CUSTOM',
        reason: 'Custom reason',
        impact: 'Custom impact',
        action: 'Custom action',
      });

      expect(msg).toContain('Reason / Lý do: Custom reason');
      expect(msg).toContain('Impact / Tác động: Custom impact');
      expect(msg).toContain('Action for CEO / Hướng xử lý: Custom action');
    });
  });

  describe('processOpsAlert', () => {
    it('returns unconfigured without crashing if TELEGRAM_BOT_TOKEN is unset', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_ADMIN_CHAT_ID = '123456789';

      const result = await processOpsAlert({
        provider: 'fal-ai',
        failureKind: 'AUTH_FAILURE',
      });

      expect(result).toEqual({ sent: false, reason: 'unconfigured' });
      expect(loggerWarnMock).toHaveBeenCalled();
      expect(sendTelegramMessageMock).not.toHaveBeenCalled();
    });

    it('returns unconfigured without crashing if chat ID is unset', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token';
      delete process.env.TELEGRAM_ADMIN_CHAT_ID;
      delete process.env.TELEGRAM_CHAT_ID;
      delete process.env.ADMIN_TELEGRAM_CHAT_ID;
      delete process.env.TELEGRAM_FOUNDER_CHAT_ID;

      const result = await processOpsAlert({
        provider: 'fal-ai',
        failureKind: 'AUTH_FAILURE',
      });

      expect(result).toEqual({ sent: false, reason: 'unconfigured' });
      expect(loggerWarnMock).toHaveBeenCalled();
      expect(sendTelegramMessageMock).not.toHaveBeenCalled();
    });

    it('successfully dispatches Telegram message when credentials exist', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token';
      process.env.TELEGRAM_ADMIN_CHAT_ID = '987654321';
      sendTelegramMessageMock.mockResolvedValue({ message_id: 42 });

      const result = await processOpsAlert({
        provider: 'fal-ai',
        failureKind: 'AUTH_FAILURE',
      });

      expect(result).toEqual({
        sent: true,
        provider: 'fal-ai',
        chatId: '987654321',
      });
      expect(sendTelegramMessageMock).toHaveBeenCalledWith(
        '987654321',
        expect.stringContaining('fal-ai')
      );
      expect(loggerInfoMock).toHaveBeenCalled();
    });

    it('handles delivery failure from sendTelegramMessage gracefully', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token';
      process.env.TELEGRAM_ADMIN_CHAT_ID = '987654321';
      sendTelegramMessageMock.mockResolvedValue(null);

      const result = await processOpsAlert({
        provider: 'openrouter',
        failureKind: 'RATE_LIMIT',
      });

      expect(result).toEqual({
        sent: false,
        reason: 'delivery_failed',
        provider: 'openrouter',
      });
      expect(loggerWarnMock).toHaveBeenCalled();
    });
  });
});
