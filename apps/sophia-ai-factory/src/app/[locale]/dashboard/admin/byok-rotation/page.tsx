// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/byok-rotation — BYOK key rotation management page (admin only).
 *
 * Server component: tier gate, fetch key_versions + rotation audit events,
 * then pass data as props to client components.
 *
 * @module app/[locale]/dashboard/admin/byok-rotation/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { getD1 } from '@/seed/db/client';
import { Shield } from 'lucide-react';
import RotationButton from './components/rotation-button';
import VersionTable from './components/version-table';
import StatusLog from './components/status-log';

export const dynamic = 'force-dynamic';

interface KeyVersionRaw {
  id: string;
  key_type: string;
  version: number;
  created_at: string;
  rotated_at: string | null;
  rotated_by: string | null;
  is_active: number;
}

interface RotationEventRaw {
  id: string;
  action: string;
  details: string | null;
  created_at: number;
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export interface KeyVersionDto {
  id: string;
  version: number;
  createdAt: string;
  isActive: boolean;
}

export interface RotationEventDto {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: number;
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export default async function ByokRotationPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const isVi = locale.startsWith('vi');
  await requireMasterTier();

  const db = getD1();
  if (!db) {
    return (
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold">
              {isVi ? 'Quản Lý Key Rotation' : 'Key Rotation Management'}
            </h1>
          </div>
        </header>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {isVi ? 'D1 database binding not available' : 'D1 database binding not available'}
        </div>
      </div>
    );
  }

  let versions: KeyVersionDto[] = [];
  let events: RotationEventDto[] = [];
  let fetchError: string | null = null;

  try {
    const versionsResult = await db
      .prepare(
        `SELECT id, key_type, version, created_at, rotated_at, rotated_by, is_active
         FROM key_versions
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .all<KeyVersionRaw>();

    versions = (versionsResult.results ?? []).map((r) => ({
      id: r.id,
      version: r.version,
      createdAt: r.created_at,
      isActive: r.is_active === 1,
    }));

    // Query rotation audit events from raas_audit_logs
    // logAuditEvent() uppercases the action and stores metadata in details JSON
    const eventsResult = await db
      .prepare(
        `SELECT id, action, details, created_at
         FROM raas_audit_logs
         WHERE action LIKE ?
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind('KEY_ROTATION.%')
      .all<RotationEventRaw>();

    events = (eventsResult.results ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      details: parseDetails(r.details),
      createdAt: Number(r.created_at),
    }));
  } catch (err) {
    fetchError = String(err);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Shield className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">
            {isVi ? 'Quản Lý Key Rotation' : 'Key Rotation Management'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isVi
              ? 'Quản lý vòng đời mã hóa: tạo phiên bản khóa mới, theo dõi lịch sử thay đổi.'
              : 'Manage encryption key lifecycle: create new key versions, track rotation history.'}
          </p>
        </div>
      </header>

      {fetchError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {isVi ? 'Lỗi tải dữ liệu: ' : 'Failed to load data: '}
          {fetchError}
        </div>
      )}

      <RotationButton locale={locale} />

      <VersionTable versions={versions} isVi={isVi} />

      <StatusLog events={events} isVi={isVi} />
    </div>
  );
}
