import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { MarketplaceStitchSection } from '@/forest/components/sop/marketplace-stitch-section';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}

const categoryLabels: Record<string, { en: string; vi: string }> = {
  content: { en: 'Content', vi: 'Nội dung' },
  sales: { en: 'Sales', vi: 'Bán hàng' },
  leads: { en: 'Leads', vi: 'Khách hàng tiềm năng' },
  analytics: { en: 'Analytics', vi: 'Phân tích' },
  proposals: { en: 'Proposals', vi: 'Đề xuất' },
  crisis: { en: 'Crisis', vi: 'Khủng hoảng' },
};

export async function generateMetadata({ searchParams, params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { category } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'sop.marketplace' });

  const baseTitle = t('title');
  const baseDescription = t('subtitle');

  if (category && category !== 'all') {
    const label = categoryLabels[category]?.['en'] ?? category;
    const labelVi = categoryLabels[category]?.['vi'] ?? category;
    const localizedLabel = locale === 'vi' ? labelVi : label;

    return buildPublicPageMetadata({
      locale,
      path: '/sop-marketplace',
      title: `${localizedLabel} ${baseTitle}`,
      description: `${baseDescription} — ${localizedLabel} category`,
    });
  }

  return buildPublicPageMetadata({
    locale,
    path: '/sop-marketplace',
    title: baseTitle,
    description: baseDescription,
  });
}

export default async function SOPMarketplacePage({ params, searchParams: _searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sop.marketplace' });

  return (
    <main className="min-h-screen bg-[#0F0F11]">
      <WebPageJsonLd
        id="sop-marketplace"
        title={t('title')}
        description={t('subtitle')}
        path="/sop-marketplace"
        locale={locale}
        schemaType="CollectionPage"
      />
      <MarketplaceStitchSection fetchUrl="/api/sop-marketplace?limit=100" />
    </main>
  );
}