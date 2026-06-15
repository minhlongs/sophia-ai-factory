"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function SuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [orderCode, setOrderCode] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("orderCode");
    if (code) {
      // Defer state updates to avoid synchronous set state in effect warning
      setTimeout(() => {
        setOrderCode(code);
        clearCart();
      }, 0);
    }
  }, [searchParams, clearCart]);

  return (
    <div className="max-w-2xl mx-auto px-6 text-center">
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <CardContent className="pt-12 pb-12 px-8 sm:px-12">
          <div className="w-24 h-24 mx-auto mb-6 bg-primary-container rounded-full flex items-center justify-center">
            <span className="material-symbols-rounded text-5xl text-on-primary-container">
              check
            </span>
          </div>

          <Typography
            variant="headline-large"
            className="text-primary mb-4 font-bold"
          >
            Đặt hàng thành công!
          </Typography>

          <Typography
            variant="body-large"
            className="text-on-surface-variant text-lg mb-8"
          >
            Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ xử lý đơn hàng trong thời gian
            sớm nhất.
          </Typography>

          {orderCode && (
            <div className="bg-surface-variant/30 rounded-xl p-4 mb-8 border border-outline-variant/30">
              <Typography variant="body-small" className="text-on-surface-variant mb-1">
                Mã đơn hàng
              </Typography>
              <Typography
                variant="headline-small"
                className="text-primary font-bold font-mono"
              >
                #{orderCode}
              </Typography>
            </div>
          )}

          <div className="space-y-4 text-left bg-surface-variant/30 rounded-xl p-6 mb-8 border border-outline-variant/30">
            <Typography variant="title-medium" className="text-on-surface font-bold mb-2">
              Bước tiếp theo:
            </Typography>
            <div className="flex items-start gap-3">
              <span className="text-xl">📱</span>
              <Typography variant="body-medium" className="text-on-surface-variant">
                Bạn sẽ nhận được SMS xác nhận đơn hàng trong ít phút
              </Typography>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">📦</span>
              <Typography variant="body-medium" className="text-on-surface-variant">
                Đơn hàng sẽ được giao trong 2-3 ngày làm việc
              </Typography>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">📞</span>
              <Typography variant="body-medium" className="text-on-surface-variant">
                Liên hệ hotline <strong>0988 030 204</strong> nếu cần hỗ trợ
              </Typography>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/products" className="w-full sm:w-auto">
              <Button variant="filled" size="lg" className="w-full">
                Tiếp tục mua sắm
              </Button>
            </Link>
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outlined" size="lg" className="w-full">
                Về trang chủ
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Trust badges */}
      <div className="mt-8 flex flex-wrap justify-center gap-6 text-on-surface-variant/70">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">lock</span>
          <span className="text-sm">Thanh toán bảo mật</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">local_shipping</span>
          <span className="text-sm">Giao hàng toàn quốc</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">assignment_return</span>
          <span className="text-sm">Đổi trả trong 7 ngày</span>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto px-6 text-center">
      <div className="bg-surface rounded-3xl p-12 shadow-md animate-pulse border border-outline-variant/20">
        <div className="w-24 h-24 mx-auto mb-6 bg-surface-variant rounded-full" />
        <div className="h-8 bg-surface-variant rounded w-3/4 mx-auto mb-4" />
        <div className="h-4 bg-surface-variant rounded w-1/2 mx-auto" />
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-32 pb-24">
        <Suspense fallback={<LoadingFallback />}>
          <SuccessContent />
        </Suspense>
      </main>

      <FooterSection />
    </div>
  );
}
