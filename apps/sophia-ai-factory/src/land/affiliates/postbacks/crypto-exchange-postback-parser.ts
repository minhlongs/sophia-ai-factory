/**
 * Crypto Exchange Postback Parsers (Binance & Bybit)
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/crypto-exchange-postback-parser
 */

import type { NormalizedPostbackEvent } from './saas-crypto-postback-types';

export function parseBinance(
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

export function parseBybit(
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
