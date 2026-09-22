import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatLeadQualifiedAlert,
  formatPaymentSuccessAlert,
  notifyFounderLeadQualified,
  notifyFounderPaymentSuccess,
} from '../telegram-admin-notifier';
import * as telegramClient from '../telegram-client';

describe('telegram-admin-notifier', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.TELEGRAM_ADMIN_CHAT_ID = '123456789';
    vi.spyOn(telegramClient, 'sendTelegramMessage').mockResolvedValue({ ok: true });
    vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('formats qualified lead alert with high intent badge and niche display', () => {
    const text = formatLeadQualifiedAlert({
      chatId: '987654321',
      firstName: 'Minh Long',
      username: 'long_founder',
      niche: 'ai_agency',
      budgetTier: 'high',
      leadScore: 90,
      sourceUtm: 'vid_tt_automation01',
    });

    expect(text).toContain('Khách hàng tiềm năng mới!');
    expect(text).toContain('HIGH INTENT');
    expect(text).toContain('Minh Long');
    expect(text).toContain('@long_founder');
    expect(text).toContain('987654321');
    expect(text).toContain('AI Agency / Automation');
    expect(text).toContain('> $2,000 / tháng');
    expect(text).toContain('90/100');
    expect(text).toContain('vid_tt_automation01');
  });

  it('formats payment success alert with MRR progress and details', () => {
    const text = formatPaymentSuccessAlert({
      customerName: 'Nguyen Van A',
      email: 'a@example.com',
      tier: 'BASIC',
      amountUsd: 99,
      amountVnd: 2475000,
      provider: 'nowpayments',
      promoCode: 'SOLO100',
      paymentId: 'np_pay_777',
      orderId: 'sophia_ord_001',
      currentMrr: 2500,
      customerIndex: 5,
    });

    expect(text).toContain('THANH TOÁN THÀNH CÔNG');
    expect(text).toContain('+99 USD');
    expect(text).toContain('2.475.000 VNĐ');
    expect(text).toContain('Nguyen Van A');
    expect(text).toContain('a@example.com');
    expect(text).toContain('BASIC');
    expect(text).toContain('SOLO100');
    expect(text).toContain('NOWPAYMENTS');
    expect(text).toContain('np_pay_777');
    expect(text).toContain('sophia_ord_001');
    expect(text).toContain('*$2,500 / $5,000* (50%)');
    expect(text).toContain('#5 / 10');
  });

  it('sends alert when lead score >= 70', async () => {
    const spy = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

    await notifyFounderLeadQualified({
      chatId: '555',
      firstName: 'Alice',
      niche: 'ecommerce',
      budgetTier: 'mid',
      leadScore: 80,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      '123456789',
      expect.stringContaining('Alice'),
      expect.objectContaining({
        inline_keyboard: expect.any(Array),
      })
    );
  });

  it('skips alert when lead score < 70', async () => {
    const spy = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

    await notifyFounderLeadQualified({
      chatId: '555',
      firstName: 'Bob',
      niche: 'other',
      budgetTier: 'low',
      leadScore: 40,
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('sends payment celebration alert', async () => {
    const spy = vi.spyOn(telegramClient, 'sendTelegramMessage');

    await notifyFounderPaymentSuccess({
      customerName: 'Charlie',
      tier: 'BASIC',
      amountUsd: 99,
      provider: 'payos',
      paymentId: 'pay_999',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      '123456789',
      expect.stringContaining('Charlie')
    );
  });

  it('safely exits if TELEGRAM_ADMIN_CHAT_ID is not configured', async () => {
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    delete process.env.TELEGRAM_FOUNDER_CHAT_ID;

    const spy = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

    await notifyFounderLeadQualified({
      chatId: '555',
      firstName: 'Dave',
      niche: 'solopreneur',
      budgetTier: 'high',
      leadScore: 95,
    });

    expect(spy).not.toHaveBeenCalled();
  });
});
