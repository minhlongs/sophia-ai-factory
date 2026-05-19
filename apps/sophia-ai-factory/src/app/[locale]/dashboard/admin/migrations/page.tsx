// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/migrations — Supabase migration console (admin only).
 * Hook B UI: list migrations, copy SQL, open Supabase editor, mark applied.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/migrations/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { MigrationsClient } from './migrations-client'

interface Props { params: Promise<{ locale: string }> }

export const metadata = { title: 'Supabase Migrations | Admin | Sophia AI' }

export default async function MigrationsPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Supabase Migrations' : 'Supabase Migrations'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Sao chép SQL và áp dụng trong Supabase Dashboard. Đánh dấu đã áp dụng sau khi hoàn tất.'
            : 'Copy SQL and apply in Supabase Dashboard. Mark as applied after completion.'}
        </p>
      </div>
      <MigrationsClient locale={locale} />
    </div>
  )
}
