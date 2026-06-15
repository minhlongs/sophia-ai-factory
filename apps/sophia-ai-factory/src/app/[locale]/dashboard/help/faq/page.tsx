/**
 * /dashboard/help/faq — Bilingual FAQ for non-tech VIP partners.
 * Data-driven page rendering from data/help-content/faq.json
 * Top 15 questions covering FREE100, BYOK, plans, video credits, support.
 *
 * @module app/[locale]/dashboard/help/faq/page
 */

import { getTranslations } from 'next-intl/server';
import HelpPage from '@/components/help/HelpPage';
import faqData from '@/data/help-content/faq.json';

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata = {
  title: 'FAQ | Sophia AI',
  description: 'Frequently asked questions about Sophia AI Factory',
};

export default async function FAQPage({ params }: Props) {
  const { locale } = await params;

  return (
    <HelpPage
      locale={locale}
      data={faqData as any}
      pageTitle={locale.startsWith('vi') ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
      pageSubtitle={
        locale.startsWith('vi')
          ? 'Tổng hợp 15 câu hỏi phổ biến nhất từ partner.'
          : 'The 15 most common partner questions.'
      }
      type="faq"
    />
  );
}
