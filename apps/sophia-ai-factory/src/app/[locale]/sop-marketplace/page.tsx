import { getTranslations } from 'next-intl/server';
import { MarketplaceStitchSection } from '@/forest/components/sop/marketplace-stitch-section';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SOPMarketplacePage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sop.marketplace' });

  return (
    <div className="min-h-screen bg-[#0F0F11]">
      <MarketplaceStitchSection fetchUrl="/api/sop-marketplace?limit=100" />
    </div>
  );
}