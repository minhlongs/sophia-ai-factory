/**
 * /dashboard/help/sops — SOP Operations Guide
 *
 * Data-driven page rendering from data/help-content/sops.json
 * Bilingual (EN/VI) guide covering the full SOP lifecycle.
 *
 * @module app/[locale]/dashboard/help/sops/page
 */

import { getTranslations } from 'next-intl/server';
import HelpPage from '@/components/help/HelpPage';
import sopsData from '@/data/help-content/sops.json';

export const metadata = {
  title: 'SOP Operations Guide | Sophia AI',
  description: 'Complete guide to browsing, installing, running, and creating SOPs',
};

export default async function SopHelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('dashboard.help.sops');
  const isVi = locale.startsWith('vi');

  return (
    <HelpPage
      locale={locale}
      data={sopsData as any}
      pageTitle={isVi ? 'Hướng Dẫn Vận Hành SOP' : 'SOP Operations Guide'}
      pageSubtitle={
        isVi
          ? 'Hướng dẫn đầy đủ để duyệt, cài đặt, chạy và tạo SOP'
          : 'Complete guide to browsing, installing, running, and creating SOPs'
      }
      type="sops"
    />
  );
}
