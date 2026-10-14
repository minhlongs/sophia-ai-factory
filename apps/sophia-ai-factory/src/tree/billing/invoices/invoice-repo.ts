/**
 * Cloudflare D1 Repository for Enterprise Invoices
 *
 * @module tree/billing/invoices/invoice-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { EInvoice, InvoiceStatus } from '@/seed/types/enterprise-billing';
import { type InvoiceRow, mapRowToEInvoice } from './types';

export { createInvoiceRecord } from './invoice-create';

/**
 * Retrieve invoice by unique ID from D1.
 */
export async function getInvoiceById(db: D1Database, id: string): Promise<EInvoice | null> {
  const row = await db
    .prepare('SELECT * FROM invoices WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<InvoiceRow>();

  if (!row) return null;
  return mapRowToEInvoice(row);
}

/**
 * Retrieve all invoices for an organization, ordered by newest first.
 */
export async function getInvoicesByOrg(
  db: D1Database,
  orgId: string,
  limit: number = 50,
): Promise<EInvoice[]> {
  const { results } = await db
    .prepare('SELECT * FROM invoices WHERE org_id = ?1 ORDER BY created_at DESC LIMIT ?2')
    .bind(orgId, Math.max(1, Math.min(limit, 200)))
    .all<InvoiceRow>();

  if (!results) return [];
  return results.map(mapRowToEInvoice);
}

/**
 * Update status of an invoice (e.g. issued, paid, void).
 */
export async function updateInvoiceStatus(
  db: D1Database,
  id: string,
  status: InvoiceStatus,
  paidAt?: number,
): Promise<EInvoice | null> {
  const now = Math.floor(Date.now() / 1000);
  const effectivePaidAt = status === 'paid' ? (paidAt ?? now) : null;

  await db
    .prepare(
      'UPDATE invoices SET status = ?1, paid_at = COALESCE(?2, paid_at), updated_at = ?3 WHERE id = ?4',
    )
    .bind(status, effectivePaidAt, now, id)
    .run();

  return getInvoiceById(db, id);
}

/**
 * Mark invoice as paid with optional payment rail reference.
 */
export async function markInvoicePaid(
  db: D1Database,
  id: string,
  paidAt?: number,
  _paymentRail?: string,
  _paymentReference?: string,
): Promise<EInvoice | null> {
  return updateInvoiceStatus(db, id, 'paid', paidAt);
}
