/**
 * /dashboard/admin/byok-rotation — BYOK Master Key Rotation console.
 *
 * Server Component gated to MASTER tier. Reads the current active master key
 * version, the last 10 key_versions rows, and the last 20 key-rotation audit
 * events from raas_audit_logs, then hands them to the interactive client.
 *
 * @module app/[locale]/dashboard/admin/byok-rotation/page
 */

import { getTranslations } from 'next-intl/server';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { getD1 } from '@/seed/db/client';
import { ByokRotationClient } from './byok-rotation-client';

export const dynamic = 'force-dynamic';

export interface KeyVersionItem {
  id: string;
  key_type: string;
  version: number;
  created_at: string;
  rotated_at: string | null;
  rotated_by: string | null;
  is_active: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  user_id: string | null;
  details: string | null;
  created_at: number | string;
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminByokRotationPage({ params }: PageProps) {
  const { locale } = await params;

  // Gate: non-MASTER redirects to /dashboard?error=admin_required, unauthenticated to /vi/login
  await requireMasterTier({
    denyRedirect: '/dashboard?error=admin_required',
  });

  const t = await getTranslations({ locale, namespace: 'admin.keyRotation' });

  const d1 = await getD1();
  if (!d1) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground">{t('dbUnavailable')}</p>
        </div>
      </main>
    );
  }

  // 1. Current active master key version
  const currentVersion = await d1
    .prepare(
      `SELECT id, key_type, version, created_at, rotated_at, rotated_by, is_active
       FROM key_versions
       WHERE is_active = 1
       ORDER BY version DESC
       LIMIT 1`,
    )
    .first<KeyVersionItem | null>();

  // 2. Last 10 key versions (history)
  const versionHistory = await d1
    .prepare(
      `SELECT id, key_type, version, created_at, rotated_at, rotated_by, is_active
       FROM key_versions
       ORDER BY version DESC
       LIMIT 10`,
    )
    .all<KeyVersionItem>();

  // 3. Last 20 key-rotation audit events (action LIKE 'key_rotation.%' or 'KEY_ROTATION.%')
  const auditLogs = await d1
    .prepare(
      `SELECT id, action, user_id, details, created_at
       FROM raas_audit_logs
       WHERE LOWER(action) LIKE 'key_rotation.%'
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .all<AuditLogItem>();

  return (
    <ByokRotationClient
      locale={locale}
      currentVersion={currentVersion ?? null}
      versionHistory={versionHistory.results ?? []}
      auditLogs={auditLogs.results ?? []}
    />
  );
}
