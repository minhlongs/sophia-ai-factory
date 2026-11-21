import type { Metadata } from 'next';
import ProductsPage from '@/components/stitch/screens/products/products-page';
import { loadProductsWithSubscriberCounts } from '@/land/billing/product-catalog-loader';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function getProductsMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi
      ? 'Danh Mục Sản Phẩm & Gói Dịch Vụ | Sophia AI Factory'
      : 'Products & Plans Catalog | Sophia AI Factory',
    description: isVi
      ? 'Khám phá các sản phẩm tự động hóa video AI, gói đăng ký và giải pháp triển khai cho doanh nghiệp tại Sophia AI Factory.'
      : 'Explore Sophia AI Factory video automation products, subscription plans, and enterprise deployment solutions.',
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getProductsMeta(locale);
  return buildPublicPageMetadata({ locale, path: '/products', title, description });
}

export default async function ProductsRoute({ params }: PageProps) {
  const { locale } = await params;
  const { title, description } = getProductsMeta(locale);
  const products = await loadProductsWithSubscriberCounts();
  return (
    <>
      <WebPageJsonLd
        id="products"
        title={title}
        description={description}
        path="/products"
        locale={locale}
        schemaType="CollectionPage"
      />
      <ProductsPage initialProducts={products} />
    </>
  );
}
