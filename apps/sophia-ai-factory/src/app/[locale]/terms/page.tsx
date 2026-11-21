import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function getTermsMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Điều Khoản Sử Dụng | Sophia AI Factory' : 'Terms of Service | Sophia AI Factory',
    description: isVi
      ? 'Điều khoản sử dụng dịch vụ nền tảng tạo video AI tự động Sophia AI Factory.'
      : 'Terms of service for the Sophia AI Factory automated video production platform.',
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getTermsMeta(locale);
  return buildPublicPageMetadata({ locale, path: '/terms', title, description });
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const { title, description } = getTermsMeta(locale);
  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <WebPageJsonLd
        id="terms"
        title={title}
        description={description}
        path="/terms"
        locale={locale}
      />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          Điều Khoản Sử Dụng / Terms of Service
        </h1>
        <p className="text-muted-foreground mb-4">
          Sophia AI Factory — Điều khoản sử dụng dịch vụ.
        </p>
        <p className="text-muted-foreground text-sm">
          Trang này đang được hoàn thiện. Vui lòng quay lại sau.
          <br />
          This page is under construction. Please check back later.
        </p>
      </div>
    </main>
  );
}
