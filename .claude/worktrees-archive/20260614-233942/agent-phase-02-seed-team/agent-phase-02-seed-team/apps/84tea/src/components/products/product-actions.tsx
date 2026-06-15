"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { Product } from "@/lib/data/products";

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      priceVnd: product.price,
      weight: product.weight,
      image: product.image
    });

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Button
        variant="filled"
        size="lg"
        onClick={handleAddToCart}
        className="flex-1"
      >
        <span className="material-symbols-rounded mr-2">
          {isAdded ? "check" : "shopping_bag"}
        </span>
        {isAdded ? "Đã thêm vào giỏ" : "Thêm vào giỏ hàng"}
      </Button>
      <Button variant="outlined" size="lg" className="px-6">
        <span className="material-symbols-rounded">favorite</span>
      </Button>
    </div>
  );
}
