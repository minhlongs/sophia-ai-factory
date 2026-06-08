/**
 * /dashboard/admin/handover — Admin Customer Handover Wizard.
 * CEO clicks here to onboard new paying customers.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/handover/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { HandoverWizardClient } from './handover-wizard-client';

interface Props { params: Promise<{ locale: string }> }

export const metadata = { title: 'Customer Handover Wizard | Admin | Sophia AI' };

export default async function HandoverPage({ params }: Props) {
  const { locale } = await params;
  await requireMasterTier();

  const isVi = locale.startsWith('vi');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-muted-foreground-100">
          {isVi ? 'Wizard Bàn Giao Khách Hàng' : 'Customer Handover Wizard'}
        </h1>
        <p className="text-sm text-muted-foreground-400 mt-1">
          {isVi
            ? 'Tạo tài khoản khách hàng mới, cài đặt SOPs, gửi email chào mừng trong 3 phút.'
            : 'Create new customer account, install SOPs, send welcome email in 3 minutes.'}
        </p>
      </div>
      <HandoverWizardClient locale={locale} />
    </div>
  );
}
