/**
 * Crypto Exchange Postback Parsers (Binance & Bybit)
 *
 * Zero speculative gross multipliers: grossAmountCents is 0 if not supplied by provider.
 * Distinct transaction identity (externalTxnId) vs status event identity (eventId).
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/crypto-exchange-postback-parser
 */

import type {
  DomainBReconciliationStatus,
  NormalizedPostbackEvent,
} from './saas-crypto-postback-types';

function resolveReconciliationStatus(rawStatus: unknown): DomainBReconciliationStatus {
  const statusStr = String(rawStatus || 'approved').toLowerCase();
  if (statusStr === 'reversed' || statusStr === 'refunded' || statusStr === 'clawback') {
    return 'reversed';
  }
  if (statusStr === 'paid' || statusStr === 'paid_receipt' || statusStr === 'settled') {
    return 'paid_receipt';
  }
  if (statusStr === 'pending' || statusStr === 'unconfirmed') {
    return 'pending';
  }
  return 'approved';
}

export function computeDeterministicTxFingerprint(
  prefix: string,
  payload: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ code, 0x85ebca6b) >>> 0;
  }
  return `${prefix}_${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function parseBinance(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const txnId = String(
    payload.tradeId ||
      payload.orderId ||
      payload.id ||
      computeDeterministicTxFingerprint('bn', payload),
  );
  const affiliateId = String(payload.referralId || payload.agentId || 'bn_agent');
  const subId = payload.subUid ? String(payload.subUid) : null;
  const rebateUsd = Number(payload.rebateUsd || payload.income || payload.rebateAmount || 0);
  const rawVol = payload.tradeVolumeUsd ?? payload.volume;
  const tradeVolUsd = rawVol !== undefined && rawVol !== null ? Number(rawVol) : 0;
  const commissionCents = Math.round(rebateUsd * 100);
  const reconciliationStatus = resolveReconciliationStatus(payload.status);
  const grossCents = Number.isFinite(tradeVolUsd) && tradeVolUsd >= 0 ? Math.round(tradeVolUsd * 100) : 0;

  return {
    eventId: `binance_${txnId}_${reconciliationStatus}`,
    network: 'binance',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId: null,
    grossAmountCents: grossCents,
    commissionCents,
    currency: String(payload.asset || payload.currency || 'USD').toUpperCase(),
    eventType: reconciliationStatus === 'reversed' ? 'refund' : 'trading_rebate',
    reconciliationStatus,
    isRecurring: false,
    timestampMs: nowMs,
    rawPayload: payload,
  };
}

export function parseBybit(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const txnId = String(
    payload.order_id ||
      payload.trade_id ||
      payload.id ||
      computeDeterministicTxFingerprint('bybit', payload),
  );
  const affiliateId = String(payload.affiliate_code || payload.aff_code || 'bybit_partner');
  const subId = payload.affiliate_sub_id ? String(payload.affiliate_sub_id) : null;
  const rebateAmount = Number(payload.rebate_amount || payload.commission || 0);
  const commissionCents = Math.round(rebateAmount * 100);
  const reconciliationStatus = resolveReconciliationStatus(payload.status);
  const rawVol = payload.volume;
  const volNum = rawVol !== undefined && rawVol !== null ? Number(rawVol) : 0;
  const grossCents = Number.isFinite(volNum) && volNum >= 0 ? Math.round(volNum * 100) : 0;

  return {
    eventId: `bybit_${txnId}_${reconciliationStatus}`,
    network: 'bybit',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId: null,
    grossAmountCents: grossCents,
    commissionCents,
    currency: String(payload.coin || 'USD').toUpperCase(),
    eventType: reconciliationStatus === 'reversed' ? 'refund' : 'trading_rebate',
    reconciliationStatus,
    isRecurring: false,
    timestampMs: nowMs,
    rawPayload: payload,
  };
}
