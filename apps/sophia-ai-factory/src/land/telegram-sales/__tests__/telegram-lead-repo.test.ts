import { describe, it, expect, beforeEach } from 'vitest';
import {
  upsertLead,
  getLeadByChatId,
  recordSurveyStep,
  recordDemoDelivery,
  recordCheckoutIntent,
  markLeadPaid,
  listHighIntentLeads,
  _resetMemoryLeads,
} from '../telegram-lead-repo';

describe('telegram-lead-repo', () => {
  beforeEach(() => {
    _resetMemoryLeads();
  });

  it('upserts a new lead and retrieves it by chatId', async () => {
    const lead = await upsertLead({
      telegram_chat_id: 'chat_101',
      first_name: 'Lan',
      username: 'lan_ecom',
      source_utm: 'vid_tt_01',
    });

    expect(lead.id).toMatch(/^lead_/);
    expect(lead.telegram_chat_id).toBe('chat_101');
    expect(lead.first_name).toBe('Lan');
    expect(lead.status).toBe('new');

    const fetched = await getLeadByChatId('chat_101');
    expect(fetched).not.toBeNull();
    expect(fetched?.first_name).toBe('Lan');
    expect(fetched?.username).toBe('lan_ecom');
  });

  it('records survey step: niche and budget tier', async () => {
    await upsertLead({ telegram_chat_id: 'chat_102', first_name: 'Tuan' });

    const updated = await recordSurveyStep('chat_102', {
      niche: 'solopreneur',
      budget_tier: 'mid',
      qualification_score: 75,
      status: 'survey_started',
    });

    expect(updated?.niche).toBe('solopreneur');
    expect(updated?.budget_tier).toBe('mid');
    expect(updated?.qualification_score).toBe(75);
    expect(updated?.status).toBe('survey_started');
  });

  it('records demo delivery with promoCode SOLO100', async () => {
    await upsertLead({ telegram_chat_id: 'chat_103' });

    const updated = await recordDemoDelivery('chat_103', 'SOLO100');
    expect(updated?.status).toBe('demo_sent');
    expect(updated?.demo_video_sent_at).not.toBeNull();
    expect(updated?.promo_code_offered).toBe('SOLO100');
  });

  it('records checkout intent for payment provider', async () => {
    await upsertLead({ telegram_chat_id: 'chat_104' });

    const updated = await recordCheckoutIntent('chat_104', 'payos', 'ord_payos_123');
    expect(updated?.status).toBe('checkout_initiated');
    expect(updated?.payment_method_selected).toBe('payos');
    expect(updated?.checkout_order_id).toBe('ord_payos_123');
  });

  it('marks lead as paid', async () => {
    await upsertLead({ telegram_chat_id: 'chat_105' });

    const updated = await markLeadPaid('chat_105', 'ord_paid_999');
    expect(updated?.status).toBe('paid');
    expect(updated?.checkout_order_id).toBe('ord_paid_999');
  });

  it('filters high intent leads with score >= 70', async () => {
    await upsertLead({ telegram_chat_id: 'lead_low', qualification_score: 45 });
    await upsertLead({ telegram_chat_id: 'lead_mid', qualification_score: 70 });
    await upsertLead({ telegram_chat_id: 'lead_high', qualification_score: 95 });

    const highIntent = await listHighIntentLeads(70);
    const chatIds = highIntent.map((l) => l.telegram_chat_id);

    expect(chatIds).toContain('lead_mid');
    expect(chatIds).toContain('lead_high');
    expect(chatIds).not.toContain('lead_low');
  });
});
