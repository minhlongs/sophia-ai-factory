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

function parseBinance(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const txnId = String(payload.tradeId || payload.orderId || payload.id || `bn_${nowMs}`);
  const affiliateId = String(payload.referralId || payload.agentId || 'bn_agent');
  const subId = payload.subUid ? String(payload.subUid) : null;
  const rebateUsd = Number(payload.rebateUsd || payload.income || payload.rebateAmount || 0);
  const tradeVolUsd = Number(payload.tradeVolumeUsd || payload.volume || rebateUsd * 1000);
  const commissionCents = Math.round(rebateUsd * 100);

  return {
    eventId: `binance_${txnId}`,
    network: 'binance',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId: null,
    grossAmountCents: Math.round(tradeVolUsd * 100),
    commissionCents,
    currency: 'USD',
    eventType: 'trading_rebate',
    isRecurring: false,
    timestampMs: nowMs,
    rawPayload: payload,
  };
}

function parseBybit(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const txnId = String(payload.order_id || payload.trade_id || payload.id || `bybit_${nowMs}`);
  const affiliateId = String(payload.affiliate_code || payload.aff_code || 'bybit_partner');
  const subId = payload.affiliate_sub_id ? String(payload.affiliate_sub_id) : null;
  const rebateAmount = Number(payload.rebate_amount || payload.commission || 0);
  const commissionCents = Math.round(rebateAmount * 100);

  return {
    eventId: `bybit_${txnId}`,
    network: 'bybit',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId: null,
    grossAmountCents: Math.round(Number(payload.volume || rebateAmount * 500) * 100),
    commissionCents,
    currency: String(payload.coin || 'USD').toUpperCase(),
    eventType: 'trading_rebate',
    isRecurring: false,
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
