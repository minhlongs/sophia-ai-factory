"use client";

import { useCart, CartItem } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";

interface AddToCartButtonProps {
  product: Omit<CartItem, "quantity">;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem(product);
  };

  return (
    <Button
      onClick={handleAddToCart}
      variant="filled"
      size="lg"
      className="flex-1 w-full rounded-full text-lg gap-2"
    >
      🛒 Thêm vào giỏ hàng
    </Button>
  );
}
