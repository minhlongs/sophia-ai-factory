/**
 * /dashboard/help/faq — Bilingual FAQ for non-tech VIP partners.
 * Top 15 questions covering FREE100, BYOK, plans, video credits, support.
 *
 * @module app/[locale]/dashboard/help/faq/page
 */

import Link from 'next/link'
import { HelpCircle } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = {
  title: 'FAQ | Sophia AI',
  description: 'Frequently asked questions about Sophia AI Factory',
}

interface QA {
  q: string
  a: string
  link?: { href: string; label: string }
}

interface Section {
  heading: string
  items: QA[]
}

const SECTIONS_VI: Section[] = [
  {
    heading: 'FREE100 & gói cước',
    items: [
      {
        q: 'Mã FREE100 hoạt động như thế nào?',
        a: 'FREE100 mở khoá gói MASTER trọn đời. Bạn nhập mã trên trang /pricing → đăng ký email → nhận magic link → click để vào dashboard. Không cần thẻ tín dụng, không auto-charge.',
        link: { href: '/pricing', label: 'Mở trang giá' },
      },
      {
        q: 'Gói MASTER bao gồm những gì?',
        a: 'Truy cập tất cả tính năng: video AI không giới hạn (theo BYOK), 31 SOP templates, Telegram bot, audit logs, API access, multi-language support. Tier tồn tại vĩnh viễn cho tài khoản của bạn.',
      },
      {
        q: 'Magic link của tôi đã hết hạn — phải làm sao?',
        a: 'Vào trang /welcome/expired, nhập email đã đăng ký, hệ thống sẽ gửi link mới. Mỗi giờ tối đa 3 lần gửi lại.',
        link: { href: '/welcome/invalid', label: 'Gửi lại magic link' },
      },
      {
        q: 'Tôi có thể nâng cấp sang gói trả phí sau không?',
        a: 'Có. Sau khi FREE100 active, bạn vẫn có thể chuyển sang gói trả phí (ENTERPRISE hoặc PREMIUM) bằng USDT qua NOWPayments hoặc PayOS. Nhưng MASTER đã là gói cao nhất rồi.',
      },
    ],
  },
  {
    heading: 'BYOK (Bring Your Own Key)',
    items: [
      {
        q: 'Tôi cần API key nào để bắt đầu?',
        a: 'Bắt buộc: HeyGen (cho video avatar). Tuỳ chọn nhưng khuyến nghị: OpenRouter (LLM), ElevenLabs (giọng nói), D-ID (avatar thay thế). Mỗi key tự bạn lấy từ dashboard nhà cung cấp.',
        link: { href: '/dashboard/byok', label: 'Vào trang BYOK' },
      },
      {
        q: 'Lấy HeyGen API key ở đâu?',
        a: 'Đăng nhập app.heygen.com → Avatar → Settings → API Keys → Create New Key. Copy toàn bộ chuỗi do HeyGen cung cấp và paste vào BYOK.',
      },
      {
        q: 'API key của tôi có an toàn không?',
        a: 'Có. Key được mã hoá bằng AES-GCM trước khi lưu vào D1 database, chỉ giải mã khi gọi API. Không log raw key. Không hiển thị key trong UI sau khi lưu.',
      },
      {
        q: 'BYOK key bị báo "invalid" — tại sao?',
        a: 'Thường do: (1) copy thiếu hoặc thừa khoảng trắng, (2) key đã bị thu hồi ở dashboard nhà cung cấp, (3) tài khoản nhà cung cấp hết credit. Xem trang Troubleshooting.',
        link: { href: '/dashboard/help/troubleshooting', label: 'Xem Troubleshooting' },
      },
    ],
  },
  {
    heading: 'Video & SOPs',
    items: [
      {
        q: 'Sự khác biệt giữa "Video" và "SOP" là gì?',
        a: 'SOP = quy trình lặp lại (ví dụ: "Chiến dịch ra mắt sản phẩm 7 video"). Video = file MP4 cụ thể được render. 1 SOP có thể chạy nhiều lần để tạo nhiều video khác nhau.',
        link: { href: '/dashboard/sop-marketplace', label: 'Khám phá SOP marketplace' },
      },
      {
        q: 'Làm sao tạo video đầu tiên?',
        a: 'Cách nhanh nhất: vào /dashboard/sop-marketplace → chọn 1 SOP template phù hợp → Install → bấm "Run" → nhập tham số → chờ 2-5 phút. Video sẽ xuất hiện ở /dashboard/videos.',
        link: { href: '/dashboard/sop-marketplace', label: 'Mở SOP marketplace' },
      },
      {
        q: 'Tôi muốn xem credits còn lại?',
        a: 'Với MASTER tier, credits là không giới hạn (limit bởi API key BYOK của bạn). Xem /dashboard/billing để biết HeyGen/ElevenLabs credit usage thực tế.',
      },
      {
        q: 'Có thể share video với team không?',
        a: 'Có. Mỗi video có signed URL download có hạn 7 ngày. Vào /dashboard/videos → chọn video → Copy share link.',
      },
    ],
  },
  {
    heading: 'Telegram & Multi-language',
    items: [
      {
        q: 'Cách kết nối Telegram bot?',
        a: 'Vào /welcome/[token] (sau khi đăng ký) → click "Connect Telegram" → @Sophia_Bbot mở tự động → bấm Start. Hoặc /dashboard/settings → Integrations → Telegram.',
        link: { href: '/guide/telegram', label: 'Hướng dẫn chi tiết' },
      },
      {
        q: 'Sophia hỗ trợ ngôn ngữ nào?',
        a: 'UI: Tiếng Việt + English. Video output: phụ thuộc model bạn dùng (HeyGen hỗ trợ 40+ ngôn ngữ, ElevenLabs 30+).',
      },
      {
        q: 'Đổi ngôn ngữ UI ở đâu?',
        a: 'URL prefix: /vi/* cho Tiếng Việt, /en/* cho English. Hoặc Settings → Language. Lựa chọn được lưu trong cookie.',
      },
    ],
  },
]

const SECTIONS_EN: Section[] = [
  {
    heading: 'FREE100 & Plans',
    items: [
      {
        q: 'How does the FREE100 code work?',
        a: 'FREE100 unlocks lifetime MASTER tier. Enter the code on /pricing → register email → receive magic link → click to enter dashboard. No credit card, no auto-billing.',
        link: { href: '/pricing', label: 'Open pricing' },
      },
      {
        q: 'What does MASTER tier include?',
        a: 'Access to everything: unlimited AI videos (subject to your BYOK), 31 SOP templates, Telegram bot, audit logs, API access, multi-language support. Tier persists for the account lifetime.',
      },
      {
        q: 'My magic link expired — what now?',
        a: 'Go to /welcome/expired, enter the email you registered with — a new link will be sent. Max 3 resends per hour.',
        link: { href: '/welcome/invalid', label: 'Resend magic link' },
      },
      {
        q: 'Can I upgrade to a paid plan later?',
        a: 'Yes. After FREE100 is active, you can still switch to a paid plan (ENTERPRISE or PREMIUM) via NOWPayments USDT or PayOS. But MASTER is already the highest tier.',
      },
    ],
  },
  {
    heading: 'BYOK (Bring Your Own Key)',
    items: [
      {
        q: 'Which API keys do I need to start?',
        a: 'Required: HeyGen (for avatar video). Optional but recommended: OpenRouter (LLM), ElevenLabs (voice), D-ID (alt avatar). Each key you obtain from the provider dashboard.',
        link: { href: '/dashboard/byok', label: 'Open BYOK page' },
      },
      {
        q: 'Where do I get a HeyGen API key?',
        a: 'Sign in to app.heygen.com → Avatar → Settings → API Keys → Create New Key. Copy the entire string from HeyGen and paste into BYOK.',
      },
      {
        q: 'Is my API key safe?',
        a: 'Yes. Keys are AES-GCM encrypted before storage in D1, decrypted only when calling the upstream API. No raw key logging. Key not shown in UI after save.',
      },
      {
        q: 'My BYOK key returns "invalid" — why?',
        a: 'Common causes: (1) copy missed or added whitespace, (2) key revoked at provider dashboard, (3) provider account out of credit. See Troubleshooting.',
        link: { href: '/dashboard/help/troubleshooting', label: 'Open troubleshooting' },
      },
    ],
  },
  {
    heading: 'Videos & SOPs',
    items: [
      {
        q: 'What is the difference between "Video" and "SOP"?',
        a: 'SOP = repeatable procedure (e.g. "Product Launch 7-Video Campaign"). Video = specific rendered MP4 file. One SOP can run multiple times to produce different videos.',
        link: { href: '/dashboard/sop-marketplace', label: 'Browse SOP marketplace' },
      },
      {
        q: 'How do I create my first video?',
        a: 'Fastest path: open /dashboard/sop-marketplace → pick a SOP template → Install → click "Run" → enter parameters → wait 2-5 minutes. Video appears at /dashboard/videos.',
        link: { href: '/dashboard/sop-marketplace', label: 'Open SOP marketplace' },
      },
      {
        q: 'Where do I see remaining credits?',
        a: 'On MASTER tier credits are unlimited (gated by your BYOK provider quota). Check /dashboard/billing for actual HeyGen/ElevenLabs usage.',
      },
      {
        q: 'Can I share videos with my team?',
        a: 'Yes. Each video has a 7-day signed download URL. Go to /dashboard/videos → pick video → Copy share link.',
      },
    ],
  },
  {
    heading: 'Telegram & Multi-language',
    items: [
      {
        q: 'How do I connect the Telegram bot?',
        a: 'On /welcome/[token] (post-signup) → click "Connect Telegram" → @Sophia_Bbot opens automatically → tap Start. Or /dashboard/settings → Integrations → Telegram.',
        link: { href: '/guide/telegram', label: 'Detailed guide' },
      },
      {
        q: 'Which languages does Sophia support?',
        a: 'UI: Vietnamese + English. Video output: depends on the model (HeyGen supports 40+, ElevenLabs 30+).',
      },
      {
        q: 'How do I change the UI language?',
        a: 'URL prefix: /vi/* for Vietnamese, /en/* for English. Or Settings → Language. The choice is stored in a cookie.',
      },
    ],
  },
]

export default async function FAQPage({ params }: Props) {
  const { locale } = await params
  const isVi = locale.startsWith('vi')
  const sections = isVi ? SECTIONS_VI : SECTIONS_EN

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Tổng hợp 15 câu hỏi phổ biến nhất từ partner.'
            : 'The 15 most common partner questions.'}
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-300">
            {section.heading}
          </h2>
          <div className="space-y-3">
            {section.items.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
              >
                <summary className="flex items-start gap-3 p-4 cursor-pointer list-none">
                  <HelpCircle
                    className="w-4 h-4 text-violet-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-zinc-200 group-open:text-white">
                    {item.q}
                  </span>
                </summary>
                <div className="px-4 pb-4 pl-11 space-y-2">
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.a}</p>
                  {item.link && (
                    <a
                      href={item.link.href}
                      className="inline-block mt-2 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-violet-300 rounded-lg transition-colors"
                    >
                      {item.link.label} →
                    </a>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-center">
        <p className="text-sm text-zinc-400">
          {isVi
            ? 'Không thấy câu trả lời? Vào '
            : "Don't see your question? Visit "}
          <Link
            href="/dashboard/help/troubleshooting"
            className="text-violet-400 hover:underline"
          >
            {isVi ? 'Khắc phục sự cố' : 'Troubleshooting'}
          </Link>
          {isVi ? ' hoặc email ' : ' or email '}
          <a
            href="mailto:support@mekongmind.com"
            className="text-violet-400 hover:underline"
          >
            support@mekongmind.com
          </a>
        </p>
      </div>
    </div>
  )
}
