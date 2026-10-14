import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ShieldCheck, Globe, Palette } from 'lucide-react';

interface UpgradePromoCardProps {
  locale: string;
}

export function UpgradePromoCard({ locale }: UpgradePromoCardProps) {
  const isVi = locale === 'vi';

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            {isVi ? 'Tính Năng Độc Quyền Gói Master & Enterprise' : 'Exclusive to Master & Enterprise Tiers'}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {isVi ? 'Nhãn Trắng Toàn Diện & Tên Miền Riêng' : 'Full White-Label & Custom Domain Engine'}
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            {isVi
              ? 'Nâng cấp lên gói Master ($4,999 trọn đời) hoặc Enterprise ($799/tháng) để sở hữu cổng tạo video AI mang 100% thương hiệu và tên miền riêng của bạn.'
              : 'Upgrade to Master ($4,999 lifetime) or Enterprise ($799/mo) to unlock complete white-label customization, custom hostnames, and automated Cloudflare SSL certificates.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <Globe className="w-6 h-6 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              {isVi ? 'Tên Miền Tùy Chỉnh' : 'Custom Hostnames'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isVi
                ? 'Gắn tên miền riêng (VD: portal.agency.com) với chứng chỉ Cloudflare SSL tự động kích hoạt.'
                : 'Map your sovereign agency domain with automatic Cloudflare for SaaS edge SSL validation.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <Palette className="w-6 h-6 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {isVi ? 'Nhận Diện Thương Hiệu' : 'Custom Brand Palette'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isVi
                ? 'Tùy biến bảng màu sắc, logo, favicon, tiêu đề trang và văn bản chân trang theo thương hiệu bạn.'
                : 'Customize logo, favicon, primary/accent color CSS variables, and portal titles seamlessly.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              {isVi ? 'Cách Ly Khách Thuê Edge' : 'Edge Tenant Isolation'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isVi
                ? 'Trích xuất ngữ cảnh khách thuê tức thì tại Cloudflare Edge mà không phát sinh độ trễ.'
                : 'Real-time host-to-tenant routing at Cloudflare Workers edge with zero database bottlenecks.'}
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-xl transition-all"
          >
            <span>{isVi ? 'Nâng Cấp Gói Master Ngay' : 'Upgrade to Master Tier Now'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
