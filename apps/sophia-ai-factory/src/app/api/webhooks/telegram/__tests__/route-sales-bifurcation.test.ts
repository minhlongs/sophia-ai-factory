import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import * as qualificationService from '@/land/telegram-sales/qualification-service';
import * as pairing from '@/tree/telegram/pairing';
import * as pairingTokenService from '@/tree/telegram/pairing-token-service';

const TEST_SECRET = 'valid_secret_token_123';

vi.mock('@/land/telegram-sales/qualification-service', () => ({
  handleLeadGreeting: vi.fn().mockResolvedValue(undefined),
  handleQualificationCallback: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/tree/telegram/pairing', () => ({
  isAllowed: vi.fn().mockResolvedValue(false),
  requestPairing: vi.fn().mockResolvedValue({ code: '654321' }),
  approvePairing: vi.fn().mockResolvedValue({ chatId: '987654' }),
  listPaired: vi.fn().mockResolvedValue([]),
  revokePairing: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/tree/telegram/pairing-token-service', () => ({
  consumePairingToken: vi.fn().mockResolvedValue({ valid: true, userId: 'user_paired_1' }),
}));

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  sendTelegramMessageWithKeyboard: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/seed/db/client', () => ({
  tryCreateServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  })),
}));

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': TEST_SECRET,
    },
    body: JSON.stringify(body),
  });
}

describe('Telegram Webhook Bifurcated Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token';
    process.env.TELEGRAM_WEBHOOK_SECRET = TEST_SECRET;
    process.env.TELEGRAM_ADMIN_CHAT_ID = '999999999';
  });

  it('routes viral video deep-link (/start vid_ecom_101) to handleLeadGreeting bypassing DM gate', async () => {
    const req = createRequest({
      message: {
        chat: { id: 111222, first_name: 'Minh' },
        from: { username: 'minh_viral' },
        text: '/start vid_ecom_101',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(qualificationService.handleLeadGreeting).toHaveBeenCalledTimes(1);
    expect(qualificationService.handleLeadGreeting).toHaveBeenCalledWith(
      '111222',
      'Minh',
      'vid_ecom_101',
      'minh_viral'
    );
    // Did not block with pairing code
    expect(pairing.requestPairing).not.toHaveBeenCalled();
  });

  it('routes promo deep-link (/start solo100) to handleLeadGreeting', async () => {
    const req = createRequest({
      message: {
        chat: { id: 333444, first_name: 'An' },
        text: '/start solo100',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(qualificationService.handleLeadGreeting).toHaveBeenCalledWith(
      '333444',
      'An',
      'solo100',
      undefined
    );
  });

  it('routes bare /start from cold unpaired visitor to handleLeadGreeting', async () => {
    vi.spyOn(pairing, 'isAllowed').mockResolvedValue(false);

    const req = createRequest({
      message: {
        chat: { id: 555666, first_name: 'Huong' },
        text: '/start',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(qualificationService.handleLeadGreeting).toHaveBeenCalledWith(
      '555666',
      'Huong',
      null,
      undefined
    );
    expect(pairing.requestPairing).not.toHaveBeenCalled();
  });

  it('routes 32-hex web pairing token to consumePairingToken', async () => {
    const validHexToken = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
    const req = createRequest({
      message: {
        chat: { id: 777888, first_name: 'WebUser' },
        text: `/start ${validHexToken}`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(pairingTokenService.consumePairingToken).toHaveBeenCalledTimes(1);
    expect(qualificationService.handleLeadGreeting).not.toHaveBeenCalled();
  });

  it('blocks privileged /campaign command for unpaired user with pairing code gate', async () => {
    vi.spyOn(pairing, 'isAllowed').mockResolvedValue(false);

    const req = createRequest({
      message: {
        chat: { id: 888999, first_name: 'Stranger' },
        text: '/campaign create ecommerce',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Blocked by pairing gate
    expect(pairing.requestPairing).toHaveBeenCalledTimes(1);
    expect(qualificationService.handleLeadGreeting).not.toHaveBeenCalled();
  });

  it('routes lead qualification callback queries to handleQualificationCallback', async () => {
    const req = createRequest({
      callback_query: {
        data: 'lead_niche:ai_agency',
        message: { chat: { id: 111222 } },
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(qualificationService.handleQualificationCallback).toHaveBeenCalledWith(
      '111222',
      'lead_niche:ai_agency'
    );
  });

  it('routes checkout payment callback queries to handleQualificationCallback', async () => {
    const req = createRequest({
      callback_query: {
        data: 'checkout_pay:payos:BASIC:SOLO100',
        message: { chat: { id: 111222 } },
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(qualificationService.handleQualificationCallback).toHaveBeenCalledWith(
      '111222',
      'checkout_pay:payos:BASIC:SOLO100'
    );
  });
});
