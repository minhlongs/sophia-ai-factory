import ProductsPage from '@/components/stitch/screens/products/products-page';
import { loadProductsWithSubscriberCounts } from '@/land/billing/product-catalog-loader';

export const dynamic = 'force-dynamic';

export default async function ProductsRoute() {
  const products = await loadProductsWithSubscriberCounts();
  return <ProductsPage initialProducts={products} />;
}
