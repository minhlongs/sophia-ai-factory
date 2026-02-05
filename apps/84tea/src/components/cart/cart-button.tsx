"use client";

import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CartButton({ className }: { className?: string }) {
  const { totalItems, setIsOpen } = useCart();

  return (
    <Button
      variant="text"
      size="icon"
      onClick={() => setIsOpen(true)}
      className={cn("relative text-on-surface hover:text-primary", className)}
      aria-label={totalItems > 0 ? `Giỏ hàng (${totalItems} sản phẩm)` : "Giỏ hàng"}
    >
      <span className="material-symbols-rounded text-[24px]">shopping_bag</span>
      {totalItems > 0 && (
        <span
          className="absolute top-0 right-0 h-4 w-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          {totalItems}
        </span>
      )}
    </Button>
  );
}
