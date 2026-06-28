"use client";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import Link from "next/link";

export function FranchiseHero() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-surface-variant">
      {/* Background with overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-tertiary to-tertiary/50 z-10" />
        {/* Placeholder for business image */}
        <div className="w-full h-full bg-tertiary animate-pulse-slow" />
      </div>

      <div className="relative z-10 container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div className="text-left text-on-tertiary animate-fade-in-up">
          <Typography
            variant="label-large"
            className="text-secondary-container tracking-[0.2em] uppercase mb-4"
          >
            Cơ hội hợp tác
          </Typography>

          <Typography
            variant="display-medium"
            className="mb-6 font-display font-medium leading-tight text-on-tertiary"
          >
            Đồng hành cùng <br />
            <span className="text-secondary-container italic">Di sản Trà Việt</span>
          </Typography>

          <Typography
            variant="body-large"
            className="text-on-tertiary mb-8 max-w-xl leading-relaxed"
          >
            Trở thành đối tác nhượng quyền của 84tea để lan tỏa tinh hoa trà cổ thụ Việt Nam.
            Mô hình kinh doanh bền vững, lợi nhuận hấp dẫn và được vận hành bởi đội ngũ chuyên gia hàng đầu.
          </Typography>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" variant="filled" className="bg-secondary text-on-secondary hover:bg-secondary-container hover:text-on-secondary-container border-none" onClick={() => document.getElementById('register-form')?.scrollIntoView({ behavior: 'smooth' })}>
              Đăng ký tư vấn ngay
            </Button>
            <Button
              size="lg"
              variant="outlined"
              className="border-on-tertiary text-on-tertiary hover:bg-on-tertiary/10"
              asChild
            >
              <Link href="#models">Tìm hiểu mô hình</Link>
            </Button>
          </div>
        </div>

        {/* Stats or Highlight */}
        <div className="hidden md:flex justify-end animate-fade-in-up delay-200">
           <div className="bg-surface/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 max-w-sm">
             <div className="grid grid-cols-2 gap-8">
               <div>
                 <Typography variant="display-medium" className="text-secondary-container font-display">50+</Typography>
                 <Typography variant="body-small" className="text-on-tertiary">Cửa hàng trên toàn quốc</Typography>
               </div>
               <div>
                 <Typography variant="display-medium" className="text-secondary-container font-display">12</Typography>
                 <Typography variant="body-small" className="text-on-tertiary">Tháng hoàn vốn trung bình</Typography>
               </div>
               <div>
                 <Typography variant="display-medium" className="text-secondary-container font-display">35%</Typography>
                 <Typography variant="body-small" className="text-on-tertiary">Lợi nhuận ròng trung bình</Typography>
               </div>
               <div>
                 <Typography variant="display-medium" className="text-secondary-container font-display">24/7</Typography>
                 <Typography variant="body-small" className="text-on-tertiary">Hỗ trợ vận hành</Typography>
               </div>
             </div>
           </div>
        </div>
      </div>
    </section>
  );
}
