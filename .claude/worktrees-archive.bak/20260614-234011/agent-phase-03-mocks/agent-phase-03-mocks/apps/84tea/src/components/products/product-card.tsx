"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import { Product } from "@/lib/data/products";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  return (
    <Card variant="elevated" className="group h-full flex flex-col hover:-translate-y-1 transition-transform duration-300">
      <div className="aspect-square relative bg-surface-variant overflow-hidden rounded-t-xl">
        {/* Tags */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {product.tags?.slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm ${
                index === 0 ? 'bg-secondary text-on-secondary' : 'bg-surface text-on-surface'
              }`}
            >
              {tag}
            </span>
          ))}
          {product.originalPrice && (
            <span className="bg-error text-on-error text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
            </span>
          )}
        </div>

        {/* Image Placeholder */}
        <div className="absolute inset-0 flex items-center justify-center text-7xl group-hover:scale-110 transition-transform duration-500 select-none">
          {product.image}
        </div>

        {/* Quick Add Overlay */}
        <div className="absolute inset-0 bg-scrim/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[1px]">
          <Button
            variant="filled"
            className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg"
            onClick={(e) => {
              e.preventDefault();
              addItem({
                id: product.id,
                name: product.name,
                priceVnd: product.price,
                weight: product.weight,
                image: product.image
              });
            }}
          >
            <span className="material-symbols-rounded mr-2">shopping_bag</span>
            Thêm vào giỏ
          </Button>
        </div>
      </div>

      <CardContent className="p-5 flex-1 flex flex-col">
        <div className="mb-2">
          <Typography variant="label-small" className="text-secondary uppercase tracking-wider">
            {product.origin || "Việt Nam"}
          </Typography>
        </div>

        <Link href={`/products/${product.slug}`} className="group-hover:text-primary transition-colors">
          <Typography variant="title-medium" className="text-on-surface mb-1 font-bold line-clamp-1">
            {product.name}
          </Typography>
        </Link>

        <Typography variant="body-small" className="text-on-surface-variant mb-3">
          {product.weight}
        </Typography>

        <Typography variant="body-medium" className="text-on-surface-variant mb-4 line-clamp-2 flex-1">
          {product.description}
        </Typography>

        <div className="flex items-end justify-between mt-auto pt-4 border-t border-outline-variant">
          <div className="flex flex-col">
             {product.originalPrice && (
              <Typography variant="label-medium" className="text-on-surface-variant line-through text-xs opacity-70">
                {product.originalPrice.toLocaleString('vi-VN')}đ
              </Typography>
             )}
            <Typography variant="title-medium" className="text-primary font-bold">
              {product.price.toLocaleString('vi-VN')}đ
            </Typography>
          </div>

          <Link href={`/products/${product.slug}`} className="text-on-surface-variant hover:text-primary transition-colors p-2 -mr-2 rounded-full hover:bg-surface-variant">
            <span className="material-symbols-rounded">arrow_forward</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
