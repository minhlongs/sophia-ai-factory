export const dynamic = 'force-dynamic';

/**
 * Customer Handover & Acceptance Sign-off Route
 * Layer: app router (Next.js App Router; can import from all layers)
 *
 * Route: /dashboard/handover & /vi/dashboard/handover
 * Loads customer handover record, active certificate, and wires digital acceptance sign-off.
 *
 * @module app/[locale]/dashboard/handover/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import type {
  CustomerHandoverRecord,
  HandoverCertificate,
} from '@/seed/handover/handover-types';
import {
  getCustomerHandover,
  getHandoverCertificate,
} from '@/tree/handover/customer-handover-service';
import { signHandoverAcceptanceAction } from '@/land/actions/handover-actions';
import { HandoverAcceptanceClient } from '@/forest/components/handover/handover-acceptance-client';

export default async function CustomerHandoverPageRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login?redirect=/dashboard/handover`);
  }

  const db = await getD1();
  let handover: CustomerHandoverRecord | null = null;

  if (db) {
    handover = await getCustomerHandover(db, user.id);

    // If customer record not yet initialized, provision initial active record
    if (!handover) {
      const initialId = `hnd_${user.id.slice(0, 16)}_${Date.now()}`;
      const agencyName = (user as { name?: string }).name || user.email.split('@')[0] || 'My Studio';
      const now = Date.now();
      try {
        await db
          .prepare(`
            INSERT INTO customer_handovers (
              id, customer_user_id, agency_name, tier, status, source,
              acceptance_status, created_at, created_by_admin_id
            ) VALUES (?1, ?2, ?3, 'PRO', 'active', 'auto_signup', 'pending', ?4, ?2)
          `)
          .bind(initialId, user.id, agencyName, now)
          .run();

        handover = await getCustomerHandover(db, user.id);
      } catch {
        // Fallback gracefully if database write has schema variation
      }
    }
  }

  // Graceful in-memory fallback for local dev or uninitialized DB
  if (!handover) {
    handover = {
      id: `hnd_${user.id}`,
      customer_user_id: user.id,
      agency_name: (user as { name?: string }).name || user.email.split('@')[0] || 'Sovereign Studio',
      agency_type: 'b2b_saas',
      tier: 'PRO',
      starter_sops: null,
      magic_link_token: null,
      magic_link_expires_at: null,
      created_by_admin_id: user.id,
      created_at: Date.now(),
      welcome_email_sent_at: Date.now(),
      customer_first_login_at: Date.now(),
      customer_first_sop_install_at: Date.now(),
      customer_first_run_at: Date.now(),
      status: 'active',
      source: 'auto_signup',
      trigger_payment_id: null,
      tenant_id: null,
      signer_name: null,
      signer_email: user.email,
      signer_role: 'Chief Executive Officer (CEO)',
      certificate_hash: null,
      acceptance_status: 'pending',
      verification_results: null,
      signed_at: null,
      verification_passed_at: null,
      certificate_r2_key: null,
      notes: null,
    };
  }

  let certificate: HandoverCertificate | null = null;
  if (db && handover.id) {
    certificate = await getHandoverCertificate(db, handover.id);
  }

  return (
    <HandoverAcceptanceClient
      handover={handover}
      initialCertificate={certificate}
      locale={locale}
      onSignAction={signHandoverAcceptanceAction}
    />
  );
}
