import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function getContactMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Liên Hệ | Sophia AI Factory' : 'Contact | Sophia AI Factory',
    description: isVi
      ? 'Liên hệ đội ngũ hỗ trợ khách hàng Sophia AI Factory qua email support@mekongmind.com.'
      : 'Contact Sophia AI Factory customer support via email at support@mekongmind.com.',
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getContactMeta(locale);
  return buildPublicPageMetadata({ locale, path: '/contact', title, description });
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  const { title, description } = getContactMeta(locale);
  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <WebPageJsonLd
        id="contact"
        title={title}
        description={description}
        path="/contact"
        locale={locale}
      />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          Liên Hệ / Contact
        </h1>
        <p className="text-muted-foreground mb-4">
          Sophia AI Factory — Hỗ trợ khách hàng.
        </p>
        <p className="text-muted-foreground text-sm">
          Email: support@mekongmind.com
        </p>
      </div>
    </main>
  );
}
