"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { ProductCard } from "@/components/products/product-card";
import { PRODUCTS } from "@/lib/data/products";

export function FeaturedProducts() {
  // Filter featured products and take the first 4
  const featuredProducts = PRODUCTS.filter(p => p.featured).slice(0, 4);

  return (
    <section className="py-24 bg-surface-container-low">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Typography variant="label-large" className="text-secondary tracking-widest uppercase mb-4">
            Bộ sưu tập
          </Typography>
          <Typography variant="headline-large" className="text-on-surface font-display mb-4">
            Tuyệt phẩm trà Việt
          </Typography>
          <Typography variant="body-large" className="text-on-surface-variant">
            Tuyển chọn những phẩm trà xuất sắc nhất từ các vùng nguyên liệu trứ danh.
          </Typography>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button variant="outlined" size="lg" asChild>
            <Link href="/products">Xem tất cả sản phẩm</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
