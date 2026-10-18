/**
 * SaaS & Crypto Postback Parser
 *
 * Normalizes vendor-specific webhook payloads into unified postback events.
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/saas-crypto-postback-parser
 */

import type {
  NormalizedPostbackEvent,
  SaasCryptoNetwork,
} from './saas-crypto-postback-types';
import { parseBinance, parseBybit } from './crypto-exchange-postback-parser';

function parsePartnerStack(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const txnId = String(payload.id || payload.reward_key || `ps_${nowMs}`);
  const affiliateId = String(payload.partner_key || payload.partner_id || 'ps_partner');
  const subId = payload.sub_id ? String(payload.sub_id) : null;
  const campaignId = payload.campaign_key ? String(payload.campaign_key) : null;
  const commissionCents = Math.round(Number(payload.reward_amount_cents || payload.amount_cents || 0));
  const grossCents = Math.round(Number(payload.sale_amount_cents || payload.total_cents || commissionCents * 3));

  return {
    eventId: `partnerstack_${txnId}`,
    network: 'partnerstack',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId,
    grossAmountCents: grossCents,
    commissionCents,
    currency: String(payload.currency || 'USD').toUpperCase(),
    eventType: 'commission_approved',
    isRecurring: true,
    timestampMs: nowMs,
    rawPayload: payload,
  };
}

function parseRewardful(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const conv = (payload.conversion || payload) as Record<string, unknown>;
  const comm = (payload.commission || payload) as Record<string, unknown>;
  const aff = (payload.affiliate || {}) as Record<string, unknown>;

  const txnId = String(conv.id || comm.id || `rw_${nowMs}`);
  const affiliateId = String(aff.token || aff.id || 'rw_affiliate');
  const subId = conv.sub_id ? String(conv.sub_id) : null;
  const campaignId = conv.campaign_id ? String(conv.campaign_id) : null;
  const commissionCents = Math.round(Number(comm.amount_cents || 0));
  const grossCents = Math.round(Number(conv.amount_cents || commissionCents * 4));

  return {
    eventId: `rewardful_${txnId}`,
    network: 'rewardful',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId,
    grossAmountCents: grossCents,
    commissionCents,
    currency: String(comm.currency || 'USD').toUpperCase(),
    eventType: 'subscription_created',
    isRecurring: true,
    timestampMs: nowMs,
    rawPayload: payload,
  };
}

export function parseSaasCryptoPostback(
  network: SaasCryptoNetwork,
  payload: Record<string, unknown>,
  nowMs: number = Date.now(),
): NormalizedPostbackEvent {
  switch (network) {
    case 'partnerstack':
      return parsePartnerStack(payload, nowMs);
    case 'rewardful':
      return parseRewardful(payload, nowMs);
    case 'binance':
      return parseBinance(payload, nowMs);
    case 'bybit':
      return parseBybit(payload, nowMs);
  }
}
