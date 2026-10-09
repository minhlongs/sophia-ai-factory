import React from 'react';
import { Link } from '@/navigation';
import { ArrowRight } from 'lucide-react';
import type { PageFaqItem } from './types';

/**
 * Niche Landing Page FAQ & Call To Action Sections
 *
 * @module components/landing/niche-page/landing-faq-cta
 */

export function FaqSection({
  faq,
  title,
}: {
  faq: PageFaqItem[];
  title: string;
}) {
  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {title}
        </h2>
        <div className="space-y-4">
          {faq.map((item, i) => (
            <details
              key={i}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <summary className="flex justify-between items-center cursor-pointer font-semibold text-gray-900 dark:text-white">
                {item.question}
                <span className="text-blue-600 dark:text-blue-400 text-xl ml-4 group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaSection({
  nicheLabel,
  isVi,
  signupUrl,
}: {
  nicheLabel: string;
  isVi: boolean;
  signupUrl: string;
}) {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {isVi
            ? `Sẵn Sàng Tạo Video ${nicheLabel} Bằng AI?`
            : `Ready to Create AI ${nicheLabel} Videos?`}
        </h2>
        <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
          {isVi
            ? 'Tham gia cùng hàng nghìn doanh nghiệp đang sử dụng Sophia AI Factory để phát triển với video.'
            : 'Join thousands of businesses using Sophia AI Factory to grow with video.'}
        </p>
        <Link
          href={signupUrl}
          className="inline-flex items-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-full text-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
        >
          {isVi ? 'Bắt Đầu Miễn Phí' : 'Start Free Today'}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}
