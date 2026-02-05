import { notFound } from "next/navigation";
import Link from "next/link";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { MainLayout, FooterSection } from "@/components/layout";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductActions } from "@/components/products/product-actions";
import { ProductCard } from "@/components/products/product-card";
import { PRODUCTS } from "@/lib/data/products";

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    slug: product.slug,
  }));
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = PRODUCTS.filter(
    (p) => p.category === product.category && p.id !== product.id
  ).slice(0, 3);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <MainLayout>
        {/* Breadcrumb */}
        <div className="bg-surface-container-low border-b border-outline-variant">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Link href="/" className="hover:text-primary transition-colors">
                Trang chủ
              </Link>
              <span className="material-symbols-rounded text-base">chevron_right</span>
              <Link href="/products" className="hover:text-primary transition-colors">
                Sản phẩm
              </Link>
              <span className="material-symbols-rounded text-base">chevron_right</span>
              <span className="text-on-surface font-medium truncate">{product.name}</span>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 mb-24">
            {/* Left: Gallery */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <ProductGallery
                mainImage={product.image}
                images={product.images}
              />
            </div>

            {/* Right: Info */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  {product.type && (
                    <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {product.type === 'green' ? 'Trà Xanh' :
                       product.type === 'black' ? 'Hồng Trà' :
                       product.type === 'white' ? 'Bạch Trà' :
                       product.type === 'oolong' ? 'Ô Long' :
                       product.type === 'herbal' ? 'Thảo Mộc' : product.type}
                    </span>
                  )}
                  {product.featured && (
                     <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Nổi bật
                    </span>
                  )}
                </div>

                <Typography variant="display-small" className="font-display text-primary mb-2">
                  {product.name}
                </Typography>

                <div className="flex items-center gap-2 text-on-surface-variant mb-6">
                   <span className="material-symbols-rounded text-secondary fill-1">star</span>
                   <span className="font-bold text-on-surface">{product.rating}</span>
                   <span className="text-outline-variant">|</span>
                   <span>{product.reviews} đánh giá</span>
                </div>

                <div className="flex items-baseline gap-4 mb-6">
                  <Typography variant="display-medium" className="text-primary font-bold">
                    {product.price.toLocaleString('vi-VN')}đ
                  </Typography>
                  {product.originalPrice && (
                    <Typography variant="title-large" className="text-outline line-through">
                      {product.originalPrice.toLocaleString('vi-VN')}đ
                    </Typography>
                  )}
                </div>

                <Typography variant="body-large" className="text-on-surface-variant leading-relaxed">
                  {product.longDescription || product.description}
                </Typography>
              </div>

              <div className="h-px bg-outline-variant" />

              {/* Attributes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant">
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <span className="material-symbols-rounded">scale</span>
                    <span className="font-bold text-sm uppercase">Trọng lượng</span>
                  </div>
                  <p className="text-on-surface">{product.weight}</p>
                </div>

                {product.origin && (
                  <div className="p-4 rounded-xl bg-surface-container border border-outline-variant">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <span className="material-symbols-rounded">landscape</span>
                      <span className="font-bold text-sm uppercase">Xuất xứ</span>
                    </div>
                    <p className="text-on-surface">{product.origin}</p>
                  </div>
                )}

                {product.harvest && (
                  <div className="p-4 rounded-xl bg-surface-container border border-outline-variant">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <span className="material-symbols-rounded">calendar_month</span>
                      <span className="font-bold text-sm uppercase">Thu hái</span>
                    </div>
                    <p className="text-on-surface">{product.harvest}</p>
                  </div>
                )}

                {product.taste && (
                  <div className="p-4 rounded-xl bg-surface-container border border-outline-variant">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <span className="material-symbols-rounded">local_cafe</span>
                      <span className="font-bold text-sm uppercase">Hương vị</span>
                    </div>
                    <p className="text-on-surface">{product.taste}</p>
                  </div>
                )}
              </div>

              <div className="h-px bg-outline-variant" />

              {/* Actions */}
              <ProductActions product={product} />

              {/* Guarantee */}
              <div className="flex items-center gap-6 pt-4 text-xs text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-primary">verified_user</span>
                  100% Chính hãng
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-primary">local_shipping</span>
                  Miễn phí vận chuyển đơn {">"} 500k
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-primary">assignment_return</span>
                  Đổi trả trong 7 ngày
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="border-t border-outline-variant pt-16">
              <div className="flex items-center justify-between mb-8">
                <Typography variant="headline-medium" className="font-display text-primary">
                  Sản phẩm liên quan
                </Typography>
                <Link href="/products">
                  <Button variant="text" className="text-primary">
                    Xem tất cả <span className="material-symbols-rounded ml-1">arrow_forward</span>
                  </Button>
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
        <FooterSection />
      </MainLayout>
    </div>
  );
}
