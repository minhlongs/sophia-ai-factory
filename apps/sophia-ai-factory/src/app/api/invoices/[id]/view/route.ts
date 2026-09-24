/**
 * GET /api/invoices/[id]/view — Secure Printable HTML Invoice Route
 *
 * Renders a compliant, responsive, printable HTML invoice with bilingual
 * labels (VI + EN), tax breakdown, and print styles. Enforces authentication,
 * tenant isolation, and platform admin access.
 *
 * Layer: land (Public API Route)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getInvoiceById, generateInvoiceHtml } from '@/tree/billing/invoice-generator';
import { logger } from '@/seed/utils/logger-utility';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
  }

  const invoice = await getInvoiceById(db, id);
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Tenant authorization: verify user is platform admin or member of the invoice's organization
  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    const isSoloOrg = invoice.orgId === `org-${user.id}`;
    if (!isSoloOrg) {
      const member = await db
        .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
        .bind(invoice.orgId, user.id)
        .first<{ role: string }>();

      if (!member) {
        logger.warn('[InvoiceViewRoute] Unauthorized invoice view access denied', {
          invoiceId: id,
          userId: user.id,
          orgId: invoice.orgId,
        });
        return NextResponse.json({ error: 'Forbidden: Access denied to this invoice' }, { status: 403 });
      }
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const localeParam = searchParams.get('locale');
  const locale: 'en' | 'vi' = localeParam === 'en' ? 'en' : 'vi';

  const html = generateInvoiceHtml(invoice, locale);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
}
