/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  isPreviewBotUserAgent,
  resolveAffiliateSubIdParam,
} from '@/tree/first-value/pilot-shortlink-repo';
import {
  buildMerchantProofSnapshot,
  PHASE1_FOCUS_PROGRAMS,
} from '../merchant-proof-snapshot';

describe('Phase 1 Clearinghouse Hardening — Bot Filter, Crypto/SaaS Sub-IDs & Merchant Proof', () => {
  it('detects preview bot user agents while allowing normal browsers', () => {
    expect(isPreviewBotUserAgent('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isPreviewBotUserAgent('ZaloPC-Preview/1.0')).toBe(true);
    expect(isPreviewBotUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isPreviewBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe(false);
    expect(isPreviewBotUserAgent(null)).toBe(false);
  });

  it('maps Crypto + SaaS Sub-ID parameters accurately while preserving legacy hints', () => {
    expect(resolveAffiliateSubIdParam('partnerstack')).toBe('ps_xid');
    expect(resolveAffiliateSubIdParam('rewardful')).toBe('via');
    expect(resolveAffiliateSubIdParam('impact')).toBe('subId1');
    expect(resolveAffiliateSubIdParam('binance')).toBe('sub_id');
    expect(resolveAffiliateSubIdParam('bybit')).toBe('sub_id');
    expect(resolveAffiliateSubIdParam('okx')).toBe('sub_id');
    expect(resolveAffiliateSubIdParam('bitget')).toBe('sub_id');
  });

  it('builds PII-free Merchant Proof Snapshot separating raw clicks, unique IPs, and filtered bots', () => {
    expect(PHASE1_FOCUS_PROGRAMS.cryptoCex).toEqual(['Binance', 'Bybit', 'OKX', 'Bitget']);
    expect(PHASE1_FOCUS_PROGRAMS.aiSaas).toContain('Notion AI');

    const snapshot = buildMerchantProofSnapshot(
      [
        { linkId: 'l1', networkHint: 'partnerstack', ipHash: 'ip_a' },
        { linkId: 'l1', networkHint: 'partnerstack', ipHash: 'ip_a' }, // duplicate IP
        { linkId: 'l1', networkHint: 'partnerstack', ipHash: 'ip_b' },
        { linkId: 'l1', networkHint: 'partnerstack', ipHash: 'ip_bot', isBot: true },
        { linkId: 'l2', networkHint: 'binance', ipHash: 'ip_c' },
      ],
      '2026-11-25T16:30:00Z',
    );

    expect(snapshot.totalRawClicks).toBe(4);
    expect(snapshot.totalUniqueVerifiedClicks).toBe(3);
    expect(snapshot.totalBotsFiltered).toBe(1);
    expect(snapshot.stage2TriggerReady).toBe(false);
    expect(snapshot.byNetwork[0]).toEqual({
      networkHint: 'partnerstack',
      rawClicks: 3,
      uniqueVerifiedClicks: 2,
      botsFiltered: 1,
    });
  });
});
