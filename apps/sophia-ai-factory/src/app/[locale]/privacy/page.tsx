import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function getPrivacyMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Chính Sách Bảo Mật | Sophia AI Factory' : 'Privacy Policy | Sophia AI Factory',
    description: isVi
      ? 'Chính sách bảo mật và xử lý dữ liệu người dùng tại Sophia AI Factory.'
      : 'Privacy policy and data protection practices for Sophia AI Factory.',
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getPrivacyMeta(locale);
  return buildPublicPageMetadata({ locale, path: '/privacy', title, description });
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const { title, description } = getPrivacyMeta(locale);
  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <WebPageJsonLd
        id="privacy"
        title={title}
        description={description}
        path="/privacy"
        locale={locale}
      />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          Chính Sách Bảo Mật / Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-4">
          Sophia AI Factory — Chính sách bảo mật dữ liệu.
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
