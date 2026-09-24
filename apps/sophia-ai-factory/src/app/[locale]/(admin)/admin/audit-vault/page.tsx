export const dynamic = 'force-dynamic';

/**
 * Cryptographic Hash-Chain Audit Vault Route (Admin Group)
 *
 * Route: /[locale]/(admin)/admin/audit-vault
 * (and /vi/admin/audit-vault, /en/admin/audit-vault)
 *
 * Layer: land (Next.js App Router Page)
 *
 * @module app/[locale]/(admin)/admin/audit-vault/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { AuditVaultExplorer } from '@/forest/audit/audit-vault-explorer';
import {
  queryEnterpriseAuditEvents,
  verifyEnterpriseAuditChain,
} from '@/tree/audit/enterprise-audit-vault';
import {
  queryEnterpriseAuditEventsAction,
  verifyEnterpriseAuditChainAction,
} from '@/land/admin/enterprise-audit-actions';
import type { EnterpriseAuditEvent, ChainVerificationResult } from '@/seed/types/enterprise-audit';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Kho Nhật Ký Kiểm Toán Mật Mã — Sophia Admin'
      : 'Cryptographic Hash-Chain Audit Vault — Sophia Admin',
    description: isVi
      ? 'Nhật ký kiểm toán bảo mật bất biến theo chuẩn SOC 2 CC7.2 với chuỗi băm SHA-256 chống thay đổi.'
      : 'Immutable, tamper-evident security audit ledger conforming to SOC 2 CC7.2 standards.',
  };
}

export default async function AdminAuditVaultPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/admin/audit-vault`);
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    redirect(`/${locale}/dashboard?error=admin_required`);
  }

  const db = await getD1();
  let orgId = await resolveOrgId(user.id, db);

  // Fallback to first org if platform admin
  if (!orgId && db) {
    try {
      const firstOrg = await db
        .prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1')
        .first<{ id: string }>();
      if (firstOrg?.id) {
        orgId = firstOrg.id;
      }
    } catch {
      // ignore
    }
  }

  const effectiveOrgId = orgId || undefined;

  let initialEvents: EnterpriseAuditEvent[] = [];
  let initialTotal = 0;
  let initialVerification: ChainVerificationResult | null = null;

  if (db) {
    try {
      const queryResult = await queryEnterpriseAuditEvents(db, {
        orgId: effectiveOrgId,
        limit: 20,
        offset: 0,
      });
      initialEvents = queryResult.events;
      initialTotal = queryResult.total;
    } catch {
      initialEvents = [];
      initialTotal = 0;
    }

    try {
      initialVerification = await verifyEnterpriseAuditChain(db, effectiveOrgId);
    } catch {
      initialVerification = null;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <AuditVaultExplorer
        orgId={effectiveOrgId}
        initialEvents={initialEvents}
        initialTotal={initialTotal}
        initialVerification={initialVerification}
        actions={{
          queryEvents: queryEnterpriseAuditEventsAction,
          verifyChain: verifyEnterpriseAuditChainAction,
        }}
      />
    </main>
  );
}
