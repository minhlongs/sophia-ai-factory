/**
 * /dashboard/admin/handover/list — Admin Handover Tracking.
 * Table of all customer handovers with milestone timelines.
 *
 * @module app/[locale]/dashboard/admin/handover/list/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { HandoverListClient } from './handover-list-client';

interface Props { params: Promise<{ locale: string }> }

export const metadata = { title: 'Handover Tracking | Admin | Sophia AI' };

export default async function HandoverListPage({ params }: Props) {
  const { locale } = await params;
  await requireMasterTier();

  const isVi = locale.startsWith('vi');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            {isVi ? 'Theo Dõi Bàn Giao' : 'Handover Tracking'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isVi
              ? 'Theo dõi hành trình kích hoạt của từng khách hàng.'
              : 'Track activation journey for every customer.'}
          </p>
        </div>
        <a
          href={`/${locale}/dashboard/admin/handover`}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          {isVi ? '+ Bàn giao mới' : '+ New Handover'}
        </a>
      </div>
      <HandoverListClient locale={locale} />
    </div>
  );
}
