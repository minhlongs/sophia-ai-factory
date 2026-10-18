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
import { SITE_URL } from '@/land/seo/solutions-schema-builder';
import { Sparkles, ArrowRight } from 'lucide-react';
import { SolutionsDirectoryGrid } from './solutions-directory-grid';

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

      <SolutionsDirectoryGrid isVi={isVi} />
    </div>
  );
}
