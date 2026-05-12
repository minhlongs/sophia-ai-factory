/**
 * /dashboard/help — Help center index. Lists all support resources.
 * Bilingual via const arrays matching the /help/getting-started pattern.
 *
 * @module app/[locale]/dashboard/help/page
 */

import { BookOpen, HelpCircle, AlertTriangle, MessageCircle, Compass } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = {
  title: 'Help Center | Sophia AI',
  description: 'Self-serve help, FAQ, and troubleshooting for Sophia AI Factory',
}

interface ResourceCard {
  href: string
  icon: typeof BookOpen
  title: string
  desc: string
  badge?: string
}

const RESOURCES_VI: ResourceCard[] = [
  {
    href: '/dashboard/help/getting-started',
    icon: Compass,
    title: 'Hướng dẫn bắt đầu',
    desc: '4 bước đơn giản để tạo video AI đầu tiên — từ API key đến video xuất ra.',
    badge: 'Bắt đầu ở đây',
  },
  {
    href: '/dashboard/help/faq',
    icon: HelpCircle,
    title: 'Câu hỏi thường gặp',
    desc: '15 câu hỏi phổ biến: cách dùng FREE100, BYOK, gói cước, video credits.',
  },
  {
    href: '/dashboard/help/troubleshooting',
    icon: AlertTriangle,
    title: 'Khắc phục sự cố',
    desc: '10 lỗi thường gặp + cách tự xử lý — magic link, HeyGen, Telegram, video kẹt.',
  },
  {
    href: '/guide/telegram',
    icon: MessageCircle,
    title: 'Hướng dẫn Telegram bot',
    desc: 'Cách kết nối @Sophia_Bbot và dùng các lệnh /campaign, /status, /results.',
  },
  {
    href: '/guide/faq',
    icon: BookOpen,
    title: 'Tài liệu công khai',
    desc: 'FAQ chung dành cho mọi người (không cần đăng nhập).',
  },
]

const RESOURCES_EN: ResourceCard[] = [
  {
    href: '/dashboard/help/getting-started',
    icon: Compass,
    title: 'Getting Started Guide',
    desc: '4 simple steps to your first AI video — from API key to rendered output.',
    badge: 'Start here',
  },
  {
    href: '/dashboard/help/faq',
    icon: HelpCircle,
    title: 'Frequently Asked Questions',
    desc: '15 common questions: how FREE100 works, BYOK, plans, video credits.',
  },
  {
    href: '/dashboard/help/troubleshooting',
    icon: AlertTriangle,
    title: 'Troubleshooting',
    desc: '10 common issues + self-fix steps — magic link, HeyGen, Telegram, stuck videos.',
  },
  {
    href: '/guide/telegram',
    icon: MessageCircle,
    title: 'Telegram bot guide',
    desc: 'How to connect @Sophia_Bbot and use /campaign, /status, /results commands.',
  },
  {
    href: '/guide/faq',
    icon: BookOpen,
    title: 'Public docs',
    desc: 'General FAQ available to everyone (no login required).',
  },
]

export default async function HelpIndexPage({ params }: Props) {
  const { locale } = await params
  const isVi = locale.startsWith('vi')
  const resources = isVi ? RESOURCES_VI : RESOURCES_EN

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Trung tâm trợ giúp' : 'Help Center'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Tự tra cứu trước khi liên hệ — phần lớn câu hỏi đã có sẵn câu trả lời ở đây.'
            : 'Self-serve first — most questions are already answered here.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {resources.map((r) => {
          const Icon = r.icon
          return (
            <a
              key={r.href}
              href={r.href}
              className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-violet-500/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-violet-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                      {r.title}
                    </h2>
                    {r.badge && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300">
                        {r.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{r.desc}</p>
                </div>
              </div>
            </a>
          )
        })}
      </div>

      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-5 space-y-2">
        <h3 className="text-sm font-semibold text-amber-300">
          {isVi ? 'Vẫn cần hỗ trợ trực tiếp?' : 'Still need direct help?'}
        </h3>
        <p className="text-sm text-zinc-400">
          {isVi
            ? 'Nếu không tìm được câu trả lời, gửi email tới: '
            : 'If you cannot find an answer, email: '}
          <a
            href="mailto:support@sophia.agencyos.network"
            className="text-amber-400 hover:underline"
          >
            support@sophia.agencyos.network
          </a>
        </p>
        <p className="text-xs text-zinc-500">
          {isVi
            ? 'Thời gian phản hồi: trong vòng 1 giờ làm việc.'
            : 'Response time: within 1 business hour.'}
        </p>
      </div>
    </div>
  )
}
