"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";

export function CTASection() {
  return (
    <section className="py-32 relative overflow-hidden flex items-center justify-center bg-surface-variant/30">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
         <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 px-6 text-center max-w-3xl mx-auto">
        <span className="material-symbols-rounded text-6xl text-primary mb-6 animate-bounce-slow">mail</span>

        <Typography variant="headline-medium" className="mb-4 font-display text-on-surface">
          Đăng ký nhận tin
        </Typography>

        <Typography variant="body-large" className="mb-8 text-on-surface-variant">
          Nhận ưu đãi 10% cho đơn hàng đầu tiên và cập nhật những kiến thức trà đạo thú vị từ 84tea.
        </Typography>

        <form className="max-w-md mx-auto flex gap-2 mb-10" onSubmit={(e) => e.preventDefault()}>
          <Input
            type="email"
            placeholder="Email của bạn"
            className="bg-surface text-on-surface border-outline"
          />
          <Button type="submit" variant="filled">
            Đăng ký
          </Button>
        </form>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 border-t border-outline-variant">
           <Typography variant="label-large" className="text-on-surface-variant">
              Hoặc khám phá ngay:
           </Typography>
          <Button variant="text" asChild>
            <Link href="/products">Bộ sưu tập</Link>
          </Button>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <Button variant="text" asChild>
            <Link href="/franchise">Nhượng quyền</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
