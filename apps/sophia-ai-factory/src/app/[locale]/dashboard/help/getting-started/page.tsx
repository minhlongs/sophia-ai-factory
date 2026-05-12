/**
 * /dashboard/help/getting-started — Bilingual onboarding guide.
 * No auth required (public within dashboard shell).
 *
 * @module app/[locale]/dashboard/help/getting-started/page
 */

import { CheckCircle } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = {
  title: 'Getting Started | Sophia AI',
  description: 'Step-by-step onboarding guide for Sophia AI',
}

const STEPS_VI = [
  {
    title: 'Bước 1: Cấu hình khóa API',
    desc: 'Vào Setup Wizard để nhập khóa HeyGen (bắt buộc) và Resend (tùy chọn).',
    link: '/setup-wizard',
    linkLabel: 'Mở Setup Wizard',
  },
  {
    title: 'Bước 2: Kiểm tra kết nối',
    desc: 'Trong Setup Wizard, nhấn nút "Kiểm tra" để xác nhận khóa HeyGen hoạt động.',
    link: '/setup-wizard',
    linkLabel: 'Kiểm tra ngay',
  },
  {
    title: 'Bước 3: Mua gói',
    desc: 'Truy cập trang Giá để mua Gói Khởi Đầu (10 video / 12 tháng) bằng USDT.',
    link: '/pricing',
    linkLabel: 'Xem gói giá',
  },
  {
    title: 'Bước 4: Tạo video đầu tiên',
    desc: 'Sau khi thanh toán được xác nhận, vào Dashboard → Videos để bắt đầu tạo video AI.',
    link: '/dashboard/videos',
    linkLabel: 'Tạo video',
  },
]

const STEPS_EN = [
  {
    title: 'Step 1: Configure API Keys',
    desc: 'Go to the Setup Wizard to enter your HeyGen API key (required) and Resend key (optional).',
    link: '/setup-wizard',
    linkLabel: 'Open Setup Wizard',
  },
  {
    title: 'Step 2: Test Connection',
    desc: 'In the Setup Wizard, click "Test" to verify your HeyGen key is working.',
    link: '/setup-wizard',
    linkLabel: 'Test Now',
  },
  {
    title: 'Step 3: Purchase a Bundle',
    desc: 'Visit the Pricing page to buy a Starter Bundle (10 videos / 12 months) with USDT.',
    link: '/pricing',
    linkLabel: 'View Pricing',
  },
  {
    title: 'Step 4: Generate Your First Video',
    desc: 'Once payment is confirmed, go to Dashboard → Videos to start creating AI videos.',
    link: '/dashboard/videos',
    linkLabel: 'Create Video',
  },
]

export default async function GettingStartedPage({ params }: Props) {
  const { locale } = await params
  const isVi = locale.startsWith('vi')
  const steps = isVi ? STEPS_VI : STEPS_EN

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Hướng Dẫn Bắt Đầu' : 'Getting Started Guide'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Làm theo 4 bước đơn giản để tạo video AI đầu tiên của bạn với Sophia AI.'
            : 'Follow these 4 simple steps to create your first AI video with Sophia AI.'}
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
          >
            <div className="shrink-0 mt-0.5">
              <CheckCircle className="w-5 h-5 text-violet-400" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-200">{step.title}</h2>
              <p className="text-sm text-zinc-400">{step.desc}</p>
              <a
                href={step.link}
                className="inline-block mt-2 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-violet-300 rounded-lg transition-colors"
              >
                {step.linkLabel} →
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-5 space-y-2">
        <h3 className="text-sm font-semibold text-amber-300">
          {isVi ? 'Cần hỗ trợ?' : 'Need Help?'}
        </h3>
        <p className="text-sm text-zinc-400">
          {isVi
            ? 'Liên hệ đội ngũ hỗ trợ qua email: '
            : 'Contact our support team via email: '}
          <a href="mailto:support@sophia.agencyos.network" className="text-amber-400 hover:underline">
            support@sophia.agencyos.network
          </a>
        </p>
      </div>
    </div>
  )
}
