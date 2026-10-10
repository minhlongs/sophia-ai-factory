'use client';

/**
 * Bottom Conversion CTA Section with SOLO100 Promo Code
 *
 * Layer: forest/solutions/interactive-sections
 */

import React from 'react';
import {
  Send,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { SolutionIndustry } from '@/seed/types/solutions-types';

interface PromoCtaSectionProps {
  industry: SolutionIndustry;
  isVi: boolean;
}

export function PromoCtaSection({ industry, isVi }: PromoCtaSectionProps) {
  const telegramUrl = `https://t.me/Sophia_Bbot?start=sol_${industry.slug}`;
  const checkoutUrl = `/checkout?plan=starter&promo=SOLO100`;

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
      <div className="max-w-2xl mx-auto relative z-10 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          {isVi ? 'Ưu Đãi Độc Quyền Cho Người Khởi Nghiệp' : 'Exclusive Early Adopter Offer'}
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {isVi
            ? `Bắt Đầu Tự Động Hóa Video Ngành ${industry.nameVi} Ngay Hôm Nay`
            : `Supercharge Your ${industry.nameEn} Growth Today`}
        </h2>

        <p className="text-sm text-zinc-300">
          {isVi
            ? 'Nhập mã SOLO100 khi thanh toán để được giảm ngay $100 (2.500.000 VNĐ). Trải nghiệm miễn phí bản demo trên Telegram trước khi đăng ký.'
            : 'Use promo code SOLO100 at checkout for an instant $100 OFF. Test our live interactive video generation directly on Telegram.'}
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={checkoutUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition hover:scale-105"
          >
            <span>{isVi ? 'Kích hoạt ngay với SOLO100 (-$100)' : 'Claim $100 OFF with SOLO100'}</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold border border-zinc-700 transition"
          >
            <Send className="w-4 h-4 text-sky-400" />
            <span>{isVi ? 'Xem demo trên Telegram' : 'Test Telegram Demo'}</span>
          </a>
        </div>

        <div className="text-[11px] text-zinc-500 pt-2">
          {isVi
            ? 'Hỗ trợ thanh toán bảo mật bằng USDT (NOWPayments) & Chuyển khoản VietQR (PayOS).'
            : 'Secure settlement via NOWPayments USDT & PayOS VietQR with instant license delivery.'}
        </div>
      </div>
    </section>
  );
}
