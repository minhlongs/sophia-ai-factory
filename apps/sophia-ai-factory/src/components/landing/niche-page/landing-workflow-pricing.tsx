import React from 'react';
import { Link } from '@/navigation';
import { CheckCircle } from 'lucide-react';

/**
 * Niche Landing Page Workflow & Pricing Teaser Sections
 *
 * @module components/landing/niche-page/landing-workflow-pricing
 */

export function HowItWorksSection({ isVi }: { isVi: boolean }) {
  const steps = isVi
    ? [
        { step: '1', title: 'Mô Tả Nhu Cầu', desc: 'Nhập chủ đề hoặc ý tưởng video của bạn. AI sẽ tạo kịch bản tự động.' },
        { step: '2', title: 'AI Tạo Video', desc: 'Sophia AI xử lý tường thuật, hình ảnh và chỉnh sửa — tất cả tự động.' },
        { step: '3', title: 'Đăng & Phát Triển', desc: 'Tải video lên mạng xã hội và thu hút khách hàng 24/7.' },
      ]
    : [
        { step: '1', title: 'Describe Your Needs', desc: 'Enter your topic or video idea. AI generates the script automatically.' },
        { step: '2', title: 'AI Creates the Video', desc: 'Sophia AI handles narration, visuals, and editing — all automated.' },
        { step: '3', title: 'Publish & Grow', desc: 'Upload to social media and attract customers 24/7.' },
      ];

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {isVi ? 'Cách Hoạt Động' : 'How It Works'}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{s.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingTeaserSection({ isVi }: { isVi: boolean }) {
  const tiers = isVi
    ? [
        { name: 'Basic', price: 'Miễn Phí', features: ['5 video/tháng', 'Giọng đọc AI cơ bản', 'Hỗ trợ email'] },
        { name: 'Premium', price: '$29/tháng', features: ['50 video/tháng', 'Giọng đọc AI cao cấp', 'Hỗ trợ ưu tiên', 'Phân tích nâng cao'] },
        { name: 'Enterprise', price: '$99/tháng', features: ['Video không giới hạn', 'Tùy chỉnh đầy đủ', 'Hỗ trợ riêng', 'API truy cập'] },
      ]
    : [
        { name: 'Basic', price: 'Free', features: ['5 videos/month', 'Basic AI voiceover', 'Email support'] },
        { name: 'Premium', price: '$29/mo', features: ['50 videos/month', 'Premium AI voices', 'Priority support', 'Advanced analytics'] },
        { name: 'Enterprise', price: '$99/mo', features: ['Unlimited videos', 'Full customization', 'Dedicated support', 'API access'] },
      ];

  return (
    <section className="py-20 bg-white dark:bg-gray-950">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          {isVi ? 'Bảng Giá Đơn Giản' : 'Simple Pricing'}
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          {isVi ? 'Bắt đầu miễn phí, nâng cấp khi bạn phát triển.' : 'Start free, upgrade as you grow.'}
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="p-8 rounded-xl border border-gray-200 dark:border-gray-800 text-center hover:shadow-lg transition-shadow"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{tier.name}</h3>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">{tier.price}</p>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold transition-colors"
              >
                {isVi ? 'Bắt Đầu' : 'Get Started'}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
