import type { Metadata } from 'next';
import FeaturesPage from '@/components/stitch/screens/features/features-page';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function getFeaturesMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi
      ? 'Tính Năng AI Video Automation | Sophia AI Factory'
      : 'AI Video Automation Features | Sophia AI Factory',
    description: isVi
      ? 'Khám phá toàn bộ tính năng tự động hóa video AI của Sophia: 40+ AI Agents, nhân bản giọng nói tiếng Việt, xuất bản đa kênh 24/7.'
      : 'Explore Sophia AI Factory features: 40+ AI Agents, voice cloning, automated video rendering, and 24/7 multi-channel publishing.',
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getFeaturesMeta(locale);
  return buildPublicPageMetadata({ locale, path: '/features', title, description });
}

export default async function FeaturesRoute({ params }: PageProps) {
  const { locale } = await params;
  const { title, description } = getFeaturesMeta(locale);
  return (
    <>
      <WebPageJsonLd
        id="features"
        title={title}
        description={description}
        path="/features"
        locale={locale}
      />
      <FeaturesPage />
    </>
  );
}
