import { NextResponse } from 'next/server';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { resolvePilotBankConfig, buildManualTransferReference } from '@/seed/config/pilot-bank-config';
import { getD1Safe } from '@/seed/db/client';
import { validatePilotAgreementInput, type PilotAgreementInput } from './manual-pilot-agreement-acceptance';
import type { MethodDispatcherInput } from './payment-dispatcher';

export interface ManualPilotCheckoutInput extends Omit<MethodDispatcherInput, 'paymentMethod'> {
  paymentMethod: MethodDispatcherInput['paymentMethod'] | 'offline_bank_transfer';
  agreement: PilotAgreementInput;
  orgId?: string;
}

export async function dispatchManualPilotOfflineCheckout(input: ManualPilotCheckoutInput): Promise<NextResponse> {
  if (input.tier !== 'BASIC' || input.period !== 'pilot_14d') return NextResponse.json({ error: 'Invalid pilot product' }, { status: 400 });
  try { validatePilotAgreementInput(input.agreement); } catch (error) {
    return NextResponse.json({ code: 'PILOT_AGREEMENT_REQUIRED', error: error instanceof Error ? error.message : 'Pilot agreement required' }, { status: 400 });
  }
  try {
    const bank = await resolvePilotBankConfig();
    if (!bank.configured) return NextResponse.json({ code: 'MANUAL_PILOT_UNAVAILABLE', reason: bank.reason, error: 'Pilot checkout is temporarily unavailable. Please retry.' }, { status: 503 });
    const db = await getD1Safe();
    if (!db) return NextResponse.json({ code: 'MANUAL_PILOT_UNAVAILABLE', error: 'Pilot checkout is temporarily unavailable. Please retry.' }, { status: 503 });
    const memberships = await db.prepare('SELECT org_id FROM org_members WHERE user_id = ?').bind(input.userId).all<{ org_id: string }>();
    const orgId = input.orgId ?? (memberships.results.length === 1 ? memberships.results[0].org_id : undefined);
    if (!orgId || !memberships.results.some(row => row.org_id === orgId)) return NextResponse.json({ code: 'ORG_REQUIRED', error: 'Authorized organization required' }, { status: 403 });
    const contract = OPTION_A_PILOT_CONTRACT;
    // A deterministic identity serializes concurrent retries without reattributing legacy orders.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([input.userId, orgId, input.agreement.version, input.agreement.hash, input.agreement.locale])));
    const orderId = `pilot_${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
    const transferReference = await buildManualTransferReference(orderId, bank.transferPrefix);
    const now = new Date().toISOString();
    // The generic pending-order contract uses `offline`; the pilot API and
    // immutable acceptance use the more specific `offline_bank_transfer`.
    const existing = await db.prepare('SELECT order_id FROM pending_orders WHERE order_id=?').bind(orderId).first();
    if (existing) {
      const compatible = await db.prepare(`SELECT a.order_id FROM manual_pilot_terms_acceptances a
        JOIN manual_pilot_settlements s ON s.order_id=a.order_id
        WHERE a.order_id=? AND a.user_id=? AND a.org_id=? AND a.sku_code=?
          AND a.agreement_version=? AND a.agreement_hash=? AND a.locale=?
          AND a.payment_method='offline_bank_transfer' AND s.transfer_reference=?`)
        .bind(orderId,input.userId,orgId,contract.skuCode,input.agreement.version,input.agreement.hash,input.agreement.locale,transferReference).first();
      if (!compatible) return NextResponse.json({ code: 'PILOT_ORDER_REVIEW_REQUIRED', error: 'Existing pilot order requires review' }, { status: 503 });
    }
    await db.batch([
      db.prepare(`INSERT INTO pending_orders(order_id,user_id,tier,period,payment_method,amount_usd_cents,amount_vnd,status,created_at)
        VALUES (?,?,'BASIC','pilot_14d','offline',?,?,'pending',?) ON CONFLICT(order_id) DO NOTHING`)
        .bind(orderId,input.userId,contract.priceUsdCents,contract.priceVnd,now),
      db.prepare(`INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,sku_code,expected_amount_vnd,transfer_reference,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,'pending_manual_payment',?,?) ON CONFLICT(order_id) DO NOTHING`)
        .bind(`mps_${orderId}`,orderId,input.userId,orgId,contract.skuCode,contract.priceVnd,transferReference,now,now),
      db.prepare(`INSERT INTO manual_pilot_financial_state(order_id,org_id,state,updated_at) VALUES (?,?,'PENDING_ORDER',?) ON CONFLICT(order_id) DO NOTHING`).bind(orderId,orgId,now),
      db.prepare(`INSERT INTO manual_pilot_audit_log(id,settlement_id,order_id,action,actor_admin_id,actor_role,metadata_json,created_at) SELECT ?,id,?,'created',NULL,'system',?,? FROM manual_pilot_settlements WHERE order_id=? AND NOT EXISTS(SELECT 1 FROM manual_pilot_audit_log WHERE order_id=? AND action='created')`).bind(`audit_${orderId}`,orderId,JSON.stringify({ expectedAmountVnd: contract.priceVnd, transferReference }),now,orderId,orderId),
      db.prepare(`INSERT INTO manual_pilot_terms_acceptances(id,order_id,user_id,org_id,sku_code,agreement_version,agreement_hash,locale,accepted_at,channel,payment_method,legal_status)
        SELECT ?,?,?,?,?,?,?,?,?,?,'offline_bank_transfer',? WHERE NOT EXISTS(SELECT 1 FROM manual_pilot_terms_acceptances WHERE order_id=?)`)
        .bind(`accept_${orderId}`,orderId,input.userId,orgId,contract.skuCode,input.agreement.version,input.agreement.hash,input.agreement.locale,now,input.agreement.channel ?? 'api_checkout',contract.legalApprovalStatus,orderId),
    ]);
    const valid = await db.prepare(`SELECT a.order_id FROM manual_pilot_terms_acceptances a JOIN pending_orders p ON p.order_id=a.order_id JOIN manual_pilot_settlements s ON s.order_id=a.order_id
      WHERE a.order_id=? AND a.user_id=? AND a.org_id=? AND a.agreement_hash=? AND a.agreement_version=? AND a.locale=? AND p.status='pending' AND p.payment_method='offline' AND p.invoice_url IS NULL AND s.user_id=a.user_id AND s.org_id=a.org_id AND s.status='pending_manual_payment'`).bind(orderId,input.userId,orgId,input.agreement.hash,input.agreement.version,input.agreement.locale).first();
    if (!valid) return NextResponse.json({ code: 'PILOT_ORDER_REVIEW_REQUIRED', error: 'Pilot order is not available for payment' }, { status: 503 });
    return NextResponse.json({ status: 'pending_manual_payment', paymentMethod: 'offline_bank_transfer', orderId, provider: 'offline_pilot', skuCode: OPTION_A_PILOT_CONTRACT.skuCode, amountVnd: OPTION_A_PILOT_CONTRACT.priceVnd, transferReference, supportEmail: OPTION_A_PILOT_CONTRACT.supportEmail, bankInstructions: { configured: true, bankName: bank.bankName, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder, transferMemo: transferReference } });
  } catch (error) {
    return NextResponse.json({ code: 'MANUAL_PILOT_UNAVAILABLE', error: error instanceof Error ? error.message : 'Pilot checkout failed' }, { status: 503 });
  }
}
