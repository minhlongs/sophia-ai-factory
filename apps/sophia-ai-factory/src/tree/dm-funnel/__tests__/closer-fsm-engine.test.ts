/**
 * @file closer-fsm-engine.test.ts
 * @description Unit tests for Conversational Closer FSM
 */

import { describe, it, expect } from 'vitest';
import { transitionCloserState } from '@/tree/dm-funnel/closer-fsm-engine';

describe('CloserFsmEngine', () => {
  const baseOfferUrl = 'https://agencyos.network/offers/deal-1';
  const subId = 'lead_9988';

  it('transitions NEW lead to QUALIFIED on opening message', () => {
    const next = transitionCloserState('NEW', 'Mình muốn hỏi mua', baseOfferUrl, subId);
    expect(next.nextState).toBe('QUALIFIED');
    expect(next.affiliateUrlToSend).toBeNull();
    expect(next.optedOut).toBe(false);
  });

  it('transitions QUALIFIED lead to LINK_SENT with tracked affiliate url', () => {
    const next = transitionCloserState('QUALIFIED', 'Mình mua cho nhu cầu cá nhân nha', baseOfferUrl, subId);
    expect(next.nextState).toBe('LINK_SENT');
    expect(next.affiliateUrlToSend).toContain('sub_id=lead_9988');
    expect(next.affiliateUrlToSend).toContain('utm_source=dm_closer');
  });

  it('handles opt-out request gracefully', () => {
    const next = transitionCloserState('LINK_SENT', 'stop', baseOfferUrl, subId);
    expect(next.nextState).toBe('OPTED_OUT');
    expect(next.optedOut).toBe(true);
    expect(next.replyMessage).toContain('ngưng');
  });

  it('handles price objection at LINK_SENT state', () => {
    const next = transitionCloserState('LINK_SENT', 'Sao giá đắt thế bạn', baseOfferUrl, subId);
    expect(next.nextState).toBe('LINK_SENT');
    expect(next.replyMessage).toContain('voucher giảm 20%');
  });
});
