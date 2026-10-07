import { describe, it, expect, vi } from 'vitest';
import {
  formatAffiliateCommissionAlert,
  sendAffiliateCommissionAlert,
} from '../telegram-affiliate-notifier';
import * as userNotifier from '../user-notifier';

describe('Telegram Affiliate Notifier', () => {
  it('formats standard commission alert with MarkdownV2 safety', () => {
    const alert = formatAffiliateCommissionAlert({
      productName: 'Cursor AI Pro 2.0',
      niche: 'saas_global',
      commissionUsd: 48.5,
      network: 'partnerstack',
      orderOrTxnId: 'TXN-998811',
      subId: 'campaign_tiktok_viral',
    });

    expect(alert).toContain('NEW AFFILIATE COMMISSION RECORDED');
    expect(alert).toContain('Cursor AI Pro 2\\.0');
    expect(alert).toContain('$48\\.50');
    expect(alert).toContain('PARTNERSTACK');
    expect(alert).toContain('TXN\\-998811');
    expect(alert).toContain('campaign\\_tiktok\\_viral');
  });

  it('formats milestone alert with celebration banner', () => {
    const alert = formatAffiliateCommissionAlert({
      productName: 'Solana Meme Token Alpha',
      niche: 'crypto_global',
      commissionUsd: 1200.0,
      network: 'binance',
      orderOrTxnId: 'BIN_REV_7722',
      isMilestone: true,
    });

    expect(alert).toContain('REVENUE MILESTONE HIT');
    expect(alert).toContain('$1200\\.00');
  });

  it('calls notifyUserByTelegram when dispatching alert', async () => {
    const spy = vi
      .spyOn(userNotifier, 'notifyUserByTelegram')
      .mockResolvedValueOnce();

    const success = await sendAffiliateCommissionAlert('user_ceo_123', {
      productName: 'Airtable Enterprise',
      niche: 'saas_global',
      commissionUsd: 120.0,
      network: 'rewardful',
      orderOrTxnId: 'REW-4411',
    });

    expect(success).toBe(true);
    expect(spy).toHaveBeenCalledWith('user_ceo_123', expect.any(String));

    spy.mockRestore();
  });
});
