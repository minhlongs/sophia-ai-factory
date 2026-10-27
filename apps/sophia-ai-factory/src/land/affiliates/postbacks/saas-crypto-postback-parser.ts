/**
 * SaaS & Crypto Postback Parser
 *
 * Normalizes vendor-specific webhook payloads into unified postback events.
 * Zero speculative gross multipliers: grossAmountCents is 0 if not supplied by provider.
 * Distinct transaction identity (externalTxnId) vs status event identity (eventId).
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/saas-crypto-postback-parser
 */

import type {
  DomainBReconciliationStatus,
  NormalizedPostbackEvent,
  SaasCryptoNetwork,
} from './saas-crypto-postback-types';
import {
  computeDeterministicTxFingerprint,
  parseBinance,
  parseBybit,
} from './crypto-exchange-postback-parser';

function resolveSaasStatus(
  rawStatus: unknown,
  defaultStatus: DomainBReconciliationStatus,
): DomainBReconciliationStatus {
  const statusStr = String(rawStatus || '').toLowerCase();
  if (statusStr === 'reversed' || statusStr === 'refunded' || statusStr === 'voided') {
    return 'reversed';
  }
  if (statusStr === 'paid' || statusStr === 'paid_receipt') {
    return 'paid_receipt';
  }
  if (statusStr === 'pending' || statusStr === 'hold') {
    return 'pending';
  }
  if (statusStr === 'approved') {
    return 'approved';
  }
  return defaultStatus;
}

function parsePartnerStack(
  payload: Record<string, unknown>,
  nowMs: number,
): NormalizedPostbackEvent {
  const txnId = String(
    payload.id ||
      payload.reward_key ||
      computeDeterministicTxFingerprint('ps', payload),
  );
  const affiliateId = String(payload.partner_key || payload.partner_id || 'ps_partner');
  const subId = payload.sub_id ? String(payload.sub_id) : null;
  const campaignId = payload.campaign_key ? String(payload.campaign_key) : null;
  const commissionCents = Math.round(Number(payload.reward_amount_cents || payload.amount_cents || 0));
  const rawGross = payload.sale_amount_cents ?? payload.total_cents;
  const grossCents = rawGross !== undefined && rawGross !== null ? Math.round(Number(rawGross)) : 0;
  const reconciliationStatus = resolveSaasStatus(payload.status, 'approved');

  return {
    eventId: `partnerstack_${txnId}_${reconciliationStatus}`,
    network: 'partnerstack',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId,
    grossAmountCents: Number.isFinite(grossCents) && grossCents >= 0 ? grossCents : 0,
    commissionCents,
    currency: String(payload.currency || 'USD').toUpperCase(),
    eventType: reconciliationStatus === 'reversed' ? 'refund' : 'commission_approved',
    reconciliationStatus,
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

  const txnId = String(
    conv.id ||
      comm.id ||
      computeDeterministicTxFingerprint('rw', payload),
  );
  const affiliateId = String(aff.token || aff.id || 'rw_affiliate');
  const subId = conv.sub_id ? String(conv.sub_id) : null;
  const campaignId = conv.campaign_id ? String(conv.campaign_id) : null;
  const commissionCents = Math.round(Number(comm.amount_cents || 0));
  const rawGross = conv.amount_cents;
  const grossCents = rawGross !== undefined && rawGross !== null ? Math.round(Number(rawGross)) : 0;
  const reconciliationStatus = resolveSaasStatus(comm.state || payload.status, 'pending');

  return {
    eventId: `rewardful_${txnId}_${reconciliationStatus}`,
    network: 'rewardful',
    externalTxnId: txnId,
    affiliateId,
    subId,
    campaignId,
    grossAmountCents: Number.isFinite(grossCents) && grossCents >= 0 ? grossCents : 0,
    commissionCents,
    currency: String(comm.currency || 'USD').toUpperCase(),
    eventType: reconciliationStatus === 'reversed' ? 'refund' : 'subscription_created',
    reconciliationStatus,
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
