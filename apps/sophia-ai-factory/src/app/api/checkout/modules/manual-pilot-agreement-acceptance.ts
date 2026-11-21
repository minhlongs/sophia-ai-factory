import type { D1Database } from '@cloudflare/workers-types';
import { OPTION_A_PILOT_CONTRACT, OPTION_A_PILOT_AGREEMENT_HASH } from '@/seed/config/tiers/option-a-pilot-contract';
import { safeCompareHex } from '@/seed/security/token-hash';

export type PilotAgreementLocale = 'vi' | 'en';
export type PilotAgreementChannel = 'web_checkout' | 'pricing_banner' | 'api_checkout';

export interface PilotAgreementInput {
  accepted: boolean;
  version: string;
  hash: string;
  locale: PilotAgreementLocale;
  channel?: PilotAgreementChannel;
}

export interface PilotAgreementContext {
  db: D1Database;
  orderId: string;
  userId: string;
  orgId?: string;
  agreement: PilotAgreementInput;
  nowIso?: string;
}

export interface PilotAgreementAcceptance {
  id: string;
  order_id: string;
  user_id: string;
  org_id: string;
  sku_code: string;
  agreement_version: string;
  agreement_hash: string;
  locale: PilotAgreementLocale;
  accepted_at: string;
  channel: PilotAgreementChannel;
  payment_method: 'offline_bank_transfer';
  legal_status: string;
}

export class PilotAgreementError extends Error {
  readonly code: 'CONSENT_REQUIRED' | 'STALE_AGREEMENT' | 'INVALID_LOCALE' | 'ORG_REQUIRED' | 'ORG_FORBIDDEN' | 'PERSISTENCE_FAILED';
  constructor(code: PilotAgreementError['code'], message: string) {
    super(message);
    this.name = 'PilotAgreementError';
    this.code = code;
  }
}

function isLocale(value: string): value is PilotAgreementLocale {
  return value === 'vi' || value === 'en';
}

function isChannel(value: string): value is PilotAgreementChannel {
  return value === 'web_checkout' || value === 'pricing_banner' || value === 'api_checkout';
}

export function validatePilotAgreementInput(input: PilotAgreementInput): void {
  if (input.accepted !== true) {
    throw new PilotAgreementError('CONSENT_REQUIRED', 'Affirmative pilot agreement acceptance is required');
  }
  if (input.version !== OPTION_A_PILOT_CONTRACT.termsVersion || !safeCompareHex(input.hash, OPTION_A_PILOT_AGREEMENT_HASH)) {
    throw new PilotAgreementError('STALE_AGREEMENT', 'Pilot agreement version or hash is no longer current');
  }
  if (!isLocale(input.locale)) {
    throw new PilotAgreementError('INVALID_LOCALE', 'Agreement locale must be vi or en');
  }
  if (input.channel !== undefined && !isChannel(input.channel)) {
    throw new PilotAgreementError('PERSISTENCE_FAILED', 'Invalid pilot agreement channel');
  }
}

async function resolveAuthorizedOrg(db: D1Database, userId: string, requestedOrgId?: string): Promise<string> {
  const rows = await db.prepare('SELECT org_id FROM org_members WHERE user_id = ? ORDER BY org_id').bind(userId).all<{ org_id: string }>();
  const memberships = rows.results ?? [];
  if (requestedOrgId) {
    if (!memberships.some((row) => row.org_id === requestedOrgId)) {
      throw new PilotAgreementError('ORG_FORBIDDEN', 'User is not authorized for the requested organization');
    }
    return requestedOrgId;
  }
  if (memberships.length !== 1) {
    throw new PilotAgreementError('ORG_REQUIRED', 'An unambiguous organization is required for pilot checkout');
  }
  return memberships[0].org_id;
}

export async function persistPilotAgreementAcceptance(
  context: PilotAgreementContext,
): Promise<PilotAgreementAcceptance> {
  validatePilotAgreementInput(context.agreement);
  const orgId = await resolveAuthorizedOrg(context.db, context.userId, context.orgId);
  const existing = await context.db.prepare(
    'SELECT * FROM manual_pilot_terms_acceptances WHERE order_id = ?',
  ).bind(context.orderId).first<PilotAgreementAcceptance>();
  if (existing) {
    if (existing.user_id !== context.userId || existing.org_id !== orgId || existing.sku_code !== OPTION_A_PILOT_CONTRACT.skuCode) {
      throw new PilotAgreementError('PERSISTENCE_FAILED', 'Pilot agreement belongs to another tenant');
    }
    if (existing.locale !== context.agreement.locale || existing.payment_method !== 'offline_bank_transfer' || existing.agreement_version !== context.agreement.version || !safeCompareHex(existing.agreement_hash, context.agreement.hash)) {
      throw new PilotAgreementError('STALE_AGREEMENT', 'Existing pilot order requires explicit reacceptance');
    }
    return existing;
  }

  const now = context.nowIso ?? new Date().toISOString();
  const acceptance: PilotAgreementAcceptance = {
    id: `mpa_${crypto.randomUUID()}`,
    order_id: context.orderId,
    user_id: context.userId,
    org_id: orgId,
    sku_code: OPTION_A_PILOT_CONTRACT.skuCode,
    agreement_version: context.agreement.version,
    agreement_hash: context.agreement.hash,
    locale: context.agreement.locale,
    accepted_at: now,
    channel: context.agreement.channel ?? 'api_checkout',
    payment_method: 'offline_bank_transfer',
    legal_status: OPTION_A_PILOT_CONTRACT.legalApprovalStatus,
  };
  try {
    await context.db.prepare(`INSERT INTO manual_pilot_terms_acceptances
      (id, order_id, user_id, org_id, sku_code, agreement_version, agreement_hash, locale, accepted_at, channel, payment_method, legal_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(acceptance.id, acceptance.order_id, acceptance.user_id, acceptance.org_id, acceptance.sku_code,
        acceptance.agreement_version, acceptance.agreement_hash, acceptance.locale, acceptance.accepted_at,
        acceptance.channel, acceptance.payment_method, acceptance.legal_status).run();
    return acceptance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to persist pilot agreement acceptance';
    throw new PilotAgreementError('PERSISTENCE_FAILED', message);
  }
}
