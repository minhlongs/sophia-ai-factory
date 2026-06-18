/**
 * /dashboard/help/troubleshooting — Bilingual self-fix guide for common issues.
 * Data-driven page rendering from data/help-content/troubleshooting.json
 *
 * @module app/[locale]/dashboard/help/troubleshooting/page
 */

import { getTranslations } from 'next-intl/server';
import HelpPage, { type HelpData } from '@/components/help/HelpPage';
import troubleshootingData from '@/data/help-content/troubleshooting.json';

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata = {
  title: 'Troubleshooting | Sophia AI',
  description: 'Self-fix guide for common Sophia AI issues',
};

export default async function TroubleshootingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('common');
  const data = troubleshootingData as HelpData;

  return (
    <HelpPage
      locale={locale}
      data={data}
      pageTitle={locale.startsWith('vi') ? 'Khắc phục sự cố' : 'Troubleshooting'}
      pageSubtitle={
        locale.startsWith('vi')
          ? 'Top 10 sự cố phổ biến + cách tự xử lý không cần liên hệ support.'
          : 'Top 10 common issues + self-fix steps — no need to contact support.'
      }
      type="troubleshooting"
    />
  );
}
