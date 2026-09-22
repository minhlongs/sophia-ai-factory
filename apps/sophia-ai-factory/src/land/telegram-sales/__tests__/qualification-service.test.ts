import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateLeadScore,
  parseStartPayload,
  handleLeadGreeting,
  handleNicheSelection,
  handleBudgetSelection,
  handleCheckoutTrigger,
  handleQualificationCallback,
} from '../qualification-service';
import * as telegramClient from '@/tree/telegram/telegram-client';
import * as adminNotifier from '@/tree/telegram/telegram-admin-notifier';
import { _resetMemoryLeads, getLeadByChatId } from '../telegram-lead-repo';

describe('qualification-service', () => {
  beforeEach(() => {
    _resetMemoryLeads();
    vi.spyOn(telegramClient, 'sendTelegramMessage').mockResolvedValue({ ok: true });
    vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard').mockResolvedValue({ ok: true });
    vi.spyOn(telegramClient, 'sendTelegramVideo').mockResolvedValue({ ok: true });
    vi.spyOn(adminNotifier, 'notifyFounderLeadQualified').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateLeadScore', () => {
    it('awards 20 points for deep-link, 30 for core niche, 50 for high budget = 100 points', () => {
      const score = calculateLeadScore('vid_tt_ecom01', 'ecommerce', 'high');
      expect(score).toBe(100);
    });

    it('awards 20 for deep-link, 30 for solopreneur, 40 for mid budget = 90 points (HIGH INTENT)', () => {
      const score = calculateLeadScore('solo100', 'solopreneur', 'mid');
      expect(score).toBe(90);
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it('awards 0 for direct arrival, 15 for other niche, 25 for low budget = 40 points', () => {
      const score = calculateLeadScore(null, 'other', 'low');
      expect(score).toBe(40);
      expect(score).toBeLessThan(70);
    });
  });

  describe('parseStartPayload', () => {
    it('parses viral video deep-link', () => {
      const parsed = parseStartPayload('vid_ecom_101');
      expect(parsed.campaignId).toBe('vid_ecom_101');
      expect(parsed.preferredNiche).toBe('ecommerce');
    });

    it('parses affiliate referral code', () => {
      const parsed = parseStartPayload('ref_LONGDO20');
      expect(parsed.referrerId).toBe('LONGDO20');
    });

    it('parses direct demo deep-link', () => {
      const parsed = parseStartPayload('demo_ai_agency');
      expect(parsed.preferredNiche).toBe('ai_agency');
    });

    it('identifies SOLO100 campaign', () => {
      const parsed = parseStartPayload('solo100');
      expect(parsed.isSolo100).toBe(true);
    });
  });

  describe('FSM Flows', () => {
    it('handleLeadGreeting creates lead and sends niche keyboard', async () => {
      const spyKeyboard = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

      await handleLeadGreeting('chat_999', 'Hai', 'vid_tt_01', 'hai_user');

      const lead = await getLeadByChatId('chat_999');
      expect(lead).not.toBeNull();
      expect(lead?.first_name).toBe('Hai');
      expect(lead?.username).toBe('hai_user');
      expect(lead?.source_utm).toBe('vid_tt_01');

      expect(spyKeyboard).toHaveBeenCalledTimes(1);
      expect(spyKeyboard).toHaveBeenCalledWith(
        'chat_999',
        expect.stringContaining('Xin chào Hai'),
        expect.objectContaining({
          inline_keyboard: expect.any(Array),
        })
      );
    });

    it('handleNicheSelection updates niche and sends budget keyboard', async () => {
      await handleLeadGreeting('chat_999', 'Hai');

      const spyKeyboard = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');
      await handleNicheSelection('chat_999', 'ai_agency');

      const lead = await getLeadByChatId('chat_999');
      expect(lead?.niche).toBe('ai_agency');
      expect(lead?.status).toBe('survey_started');

      expect(spyKeyboard).toHaveBeenCalledWith(
        'chat_999',
        expect.stringContaining('Mục tiêu và quy mô sản xuất'),
        expect.any(Object)
      );
    });

    it('handleBudgetSelection sends video demo, offers SOLO100, and alerts admin for high score', async () => {
      await handleLeadGreeting('chat_999', 'Hai', 'vid_ai_01');
      await handleNicheSelection('chat_999', 'ai_agency');

      const spyVideo = vi.spyOn(telegramClient, 'sendTelegramVideo');
      const spyKeyboard = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');
      const spyAdmin = vi.spyOn(adminNotifier, 'notifyFounderLeadQualified');

      await handleBudgetSelection('chat_999', 'high');

      const lead = await getLeadByChatId('chat_999');
      expect(lead?.budget_tier).toBe('high');
      expect(lead?.qualification_score).toBe(100);
      expect(lead?.status).toBe('demo_sent');

      // Video demo sent
      expect(spyVideo).toHaveBeenCalledTimes(1);
      // SOLO100 offer prompt sent
      expect(spyKeyboard).toHaveBeenCalledWith(
        'chat_999',
        expect.stringContaining('SOLO100'),
        expect.any(Object)
      );
      // Admin notified
      expect(spyAdmin).toHaveBeenCalledTimes(1);
      expect(spyAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 'chat_999',
          leadScore: 100,
        })
      );
    });

    it('handleCheckoutTrigger sends VietQR instructions for PayOS', async () => {
      const spyKeyboard = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

      await handleCheckoutTrigger('chat_999', 'payos', 'BASIC', 'SOLO100');

      expect(spyKeyboard).toHaveBeenCalledWith(
        'chat_999',
        expect.stringContaining('2.475.000 VNĐ'),
        expect.any(Object)
      );

      const lead = await getLeadByChatId('chat_999');
      expect(lead?.payment_method_selected).toBe('payos');
      expect(lead?.status).toBe('checkout_initiated');
    });

    it('handleCheckoutTrigger sends USDT instructions for NOWPayments', async () => {
      const spyKeyboard = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

      await handleCheckoutTrigger('chat_999', 'nowpayments', 'BASIC', 'SOLO100');

      expect(spyKeyboard).toHaveBeenCalledWith(
        'chat_999',
        expect.stringContaining('99 USDT'),
        expect.any(Object)
      );

      const lead = await getLeadByChatId('chat_999');
      expect(lead?.payment_method_selected).toBe('nowpayments');
    });

    it('handleQualificationCallback routes lead_niche and lead_budget correctly', async () => {
      await handleLeadGreeting('chat_888', 'Thao');

      await handleQualificationCallback('chat_888', 'lead_niche:ecommerce');
      let lead = await getLeadByChatId('chat_888');
      expect(lead?.niche).toBe('ecommerce');

      await handleQualificationCallback('chat_888', 'lead_budget:mid');
      lead = await getLeadByChatId('chat_888');
      expect(lead?.budget_tier).toBe('mid');
      expect(lead?.status).toBe('demo_sent');
    });

    it('handleQualificationCallback routes checkout_pay trigger correctly', async () => {
      await handleLeadGreeting('chat_888', 'Thao');
      const spyKeyboard = vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard');

      await handleQualificationCallback('chat_888', 'checkout_pay:nowpayments:BASIC:SOLO100');
      expect(spyKeyboard).toHaveBeenCalledWith(
        'chat_888',
        expect.stringContaining('99 USDT'),
        expect.any(Object)
      );
    });
  });
});
