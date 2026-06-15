"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function CartDrawer() {
  const { items, removeItem, updateQuantity, totalPrice, isOpen, setIsOpen } =
    useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer to avoid synchronous set state warning
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-md bg-surface z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <Typography variant="headline-small" className="text-on-surface">
            Giỏ hàng
          </Typography>
          <Button
            variant="text"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="rounded-full"
          >
            <span className="material-symbols-rounded">close</span>
          </Button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <span className="material-symbols-rounded text-6xl text-outline-variant mb-4">
                local_cafe
              </span>
              <Typography
                variant="body-large"
                className="text-on-surface-variant mb-4"
              >
                Giỏ hàng của bạn đang trống
              </Typography>
              <Button
                variant="filled"
                onClick={() => setIsOpen(false)}
                asChild
              >
                <Link href="/products">Khám phá Trà Cổ Thụ</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant"
                >
                  <div className="w-20 h-20 bg-surface-variant rounded-lg flex items-center justify-center flex-shrink-0 text-3xl">
                    {item.image}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <Typography
                        variant="title-medium"
                        className="truncate text-on-surface"
                      >
                        {item.name}
                      </Typography>
                      <Typography
                        variant="body-small"
                        className="text-on-surface-variant"
                      >
                        {item.weight}
                      </Typography>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Typography
                        variant="label-large"
                        className="text-primary font-bold"
                      >
                        {item.priceVnd.toLocaleString("vi-VN")}đ
                      </Typography>

                      <div className="flex items-center gap-1 bg-surface rounded-full border border-outline-variant px-1 h-8">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-full flex items-center justify-center text-on-surface hover:bg-surface-variant rounded-full text-lg leading-none"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-full flex items-center justify-center text-on-surface hover:bg-surface-variant rounded-full text-lg leading-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                     onClick={() => removeItem(item.id)}
                     className="text-error hover:bg-error-container hover:text-on-error-container p-1 rounded-full h-8 w-8 flex items-center justify-center transition-colors self-start -mt-1 -mr-1"
                  >
                    <span className="material-symbols-rounded text-lg">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-outline-variant bg-surface">
            <div className="flex justify-between items-center mb-4">
              <Typography variant="title-medium" className="text-on-surface-variant">
                Tổng cộng
              </Typography>
              <Typography variant="headline-small" className="text-primary font-bold">
                {totalPrice.toLocaleString("vi-VN")}đ
              </Typography>
            </div>
            <Button
              variant="filled"
              size="lg"
              className="w-full rounded-full"
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/checkout">Thanh toán</Link>
            </Button>
            <Typography variant="body-small" className="text-center text-on-surface-variant mt-3">
              Miễn phí vận chuyển cho đơn hàng từ 500.000đ
            </Typography>
          </div>
        )}
      </div>
    </>
  );
}
