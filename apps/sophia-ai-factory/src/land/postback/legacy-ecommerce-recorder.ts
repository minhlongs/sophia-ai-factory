/**
 * Tenant-scoped receipt writer for legacy ecommerce affiliate webhooks
 * (AccessTrade, Amazon Associates, Awin, TikTok Shop).
 *
 * Writes to conversion_events — the existing commission-workflow table — with
 * the server-resolved workspace id. There is no global-tenant fallback: callers
 * must fail closed before reaching this writer when the tenant is unknown.
 *
 * Idempotency: conversion_events carries a GLOBAL unique key on
 * network_transaction_id with no network column, so two providers can collide
 * on the same raw transaction id (e.g. numeric order ids). New receipts are
 * therefore namespaced as `{network}:{provider_txn_id}`. One-time caveat:
 * a provider retry of a pre-migration (raw-id) row inserts a second,
 * namespaced row; same-network replays of namespaced rows stay exact no-ops.
 *
 * Layer: land/postback (Business Workflow)
 * @module land/postback/legacy-ecommerce-recorder
 */

export interface LegacyEcommerceReceipt {
  tenantId: string;
  /** Legacy link row id (affiliate_links) or tracking link id; never 'unknown'. */
  linkId: string;
  clickId: string | null;
  /** Canonical legacy slug: accesstrade | amazon | awin | tiktok_shop. */
  network: string;
  providerTxnId: string;
  grossAmountUsd: number;
  commissionUsd: number;
  status: 'pending' | 'approved';
  attributedAtSec: number;
}

export interface LegacyRecordResult {
  duplicate: boolean;
}

/** Receipt namespace: see module doc for the cross-provider collision rationale. */
export function namespacedTxnId(network: string, providerTxnId: string): string {
  return `${network}:${providerTxnId}`;
}

export async function recordLegacyEcommerceConversion(
  db: D1Database,
  receipt: LegacyEcommerceReceipt,
): Promise<LegacyRecordResult> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO conversion_events
         (id, tenant_id, link_id, click_id, network_transaction_id,
          gross_amount_usd, commission_usd, status, attributed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      receipt.tenantId,
      receipt.linkId,
      receipt.clickId,
      namespacedTxnId(receipt.network, receipt.providerTxnId),
      receipt.grossAmountUsd,
      receipt.commissionUsd,
      receipt.status,
      receipt.attributedAtSec,
    )
    .run();

  return { duplicate: (res.meta?.changes ?? 1) === 0 };
}
