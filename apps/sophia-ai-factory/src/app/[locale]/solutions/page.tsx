/**
 * Solutions Directory Hub
 *
 * Route: /[locale]/solutions
 * Shows all 20+ specialized industry AI video solutions with category filtering,
 * search, and direct links to programmatic landing pages.
 *
 * @module app/[locale]/solutions/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { Link } from '@/navigation';
import { PRIMARY_SOLUTIONS } from '@/seed/config/solutions-catalog';
import { SITE_URL } from '@/land/seo/solutions-schema-builder';
import {
  Sparkles,
  ArrowRight,
  Search,
  Building2,
  ShoppingBag,
  Laptop,
  Heart,
  TrendingUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  const title = isVi
    ? 'Giải Pháp Video AI Cho Hơn 20 Ngành Nghề — Sophia AI Factory'
    : '20+ Industry Video Automation Solutions — Sophia AI Factory';

  const description = isVi
    ? 'Khám phá các giải pháp tạo video AI tự động chuyên sâu cho bất động sản, mỹ phẩm, thời trang, F&B, khóa học, tài chính và hơn thế nữa.'
    : 'Explore tailored AI video automation solutions across real estate, e-commerce, beauty, courses, healthcare, SaaS, and more.';

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${resolved.locale}/solutions`,
      languages: {
        en: `${SITE_URL}/en/solutions`,
        vi: `${SITE_URL}/vi/solutions`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${resolved.locale}/solutions`,
      siteName: 'Sophia AI Factory',
    },
  };
}

export default async function SolutionsDirectoryPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';

  const categories = Array.from(new Set(PRIMARY_SOLUTIONS.map((s) => s.category)));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <section className="pt-16 pb-14 border-b border-zinc-800/80 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isVi ? '20+ Ngành Nghề Chuyên Sâu' : '20+ Specialized Industry Solutions'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {isVi
              ? 'Giải Pháp Video AI Chuyên Biệt Theo Ngành'
              : 'Industry-Specific AI Video Solutions'}
          </h1>

          <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto">
            {isVi
              ? 'Mỗi ngành nghề có đặc thù nỗi đau và tâm lý khách hàng riêng. Sophia AI cung cấp công thức hook, kịch bản và bối cảnh video được tối ưu chuyển đổi riêng cho lĩnh vực của bạn.'
              : 'Tailored psychological hooks, script structures, and automated video workflows built specifically for your commercial niche.'}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/checkout?plan=starter&promo=SOLO100"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition"
            >
              <span>{isVi ? 'Đăng ký với mã SOLO100 (-$100)' : 'Claim $100 OFF with SOLO100'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Directory Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRIMARY_SOLUTIONS.map((industry) => (
            <Link
              key={industry.slug}
              href={`/solutions/${industry.slug}`}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-emerald-500/40 hover:bg-zinc-900/80 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    {industry.category}
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    {isVi ? 'Xem chi tiết' : 'Explore'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                  {isVi ? industry.nameVi : industry.nameEn}
                </h3>

                <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                  {isVi ? industry.heroHeadlineVi : industry.heroHeadlineEn}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                <span>{isVi ? 'Xuất video 60s' : '60s generation'}</span>
                <span className="text-zinc-400 font-mono">
                  ${industry.roiComparison.sophiaMonthlyUsd}/mo
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
