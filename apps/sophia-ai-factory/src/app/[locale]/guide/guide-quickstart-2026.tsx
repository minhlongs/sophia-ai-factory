import { Link } from '@/navigation';
import { ArrowRight, CheckCircle2, Compass, Sparkles } from 'lucide-react';

interface GuideQuickstart2026Props {
  readonly locale: 'vi' | 'en';
}

const STEPS_VI = [
  {
    step: '01',
    title: 'Nhập 1 API Key OpenRouter duy nhất (BYOK)',
    desc: 'Chỉ cần 1 key OpenRouter — hệ thống tự dùng chung cho cả AI viết kịch bản lẫn Giọng đọc TTS tự nhiên. Không cần cấu hình thêm dịch vụ nào khác.',
    cta: 'Mở Cài đặt & BYOK',
    href: '/dashboard/first-value',
  },
  {
    step: '02',
    title: 'Tạo kèo Crypto / SaaS Affiliate & dán Link Ref',
    desc: 'Chọn sản phẩm Crypto hoặc SaaS (hoa hồng 20–50% định kỳ), dán link giới thiệu của bạn và chọn thị trường (VN hoặc Quốc tế EN).',
    cta: 'Tạo kèo đầu tiên',
    href: '/dashboard/first-value',
  },
  {
    step: '03',
    title: 'Sinh & duyệt kịch bản (1 Dài → 3 Ngắn)',
    desc: 'AI tự động tạo gói kịch bản tối ưu AEO/GEO cho ChatGPT/Perplexity/Google AI và kiểm định chất lượng trước khi dựng video.',
    cta: 'Vào xưởng Kịch bản',
    href: '/dashboard/first-value',
  },
  {
    step: '04',
    title: 'Tạo Link rút gọn & Xuất Video MP4 ngay trên trình duyệt',
    desc: 'Bấm 1 nút để tạo link theo dõi /api/r/... và xuất MP4 trực tiếp (0đ phí render), hoặc dùng HeyGen BYOK (tự động báo lỗi sau 15 phút nếu nhà cung cấp treo).',
    cta: 'Xuất Video MP4',
    href: '/dashboard/first-value',
  },
  {
    step: '05',
    title: 'Đăng lên TikTok / Reels / YouTube Shorts & đo doanh thu',
    desc: 'Tải MP4 lên kênh hoặc đưa vào Hàng đợi Auto-Publish, gắn link /api/r/... ở Bio/Comment, sau đó theo dõi click thật & hoa hồng ngay tại bảng Doanh thu.',
    cta: 'Mở Hàng đợi đăng',
    href: '/dashboard/publish/queue',
  },
] as const;

const STEPS_EN = [
  {
    step: '01',
    title: 'Enter 1 OpenRouter API Key (BYOK)',
    desc: 'One OpenRouter key powers both AI script generation and natural TTS voiceover. Zero extra third-party voice accounts required.',
    cta: 'Open Setup & BYOK',
    href: '/dashboard/first-value',
  },
  {
    step: '02',
    title: 'Add a Crypto / SaaS Affiliate Offer & Ref Link',
    desc: 'Pick a high-commission Crypto or SaaS offer, paste your affiliate referral URL, and select your target market (VN or Global EN).',
    cta: 'Add First Offer',
    href: '/dashboard/first-value',
  },
  {
    step: '03',
    title: 'Generate & Approve Scripts (1 Long → 3 Shorts)',
    desc: 'AI generates AEO/GEO-optimized scripts built for AI search citations and runs quality checks before you render.',
    cta: 'Open Script Studio',
    href: '/dashboard/first-value',
  },
  {
    step: '04',
    title: 'Mint Tracking Shortlink & Export Browser MP4',
    desc: 'One click creates your /api/r/... tracking link and renders MP4 locally in the browser ($0 render fee), or use HeyGen BYOK (with 15m auto-timeout protection).',
    cta: 'Export Video MP4',
    href: '/dashboard/first-value',
  },
  {
    step: '05',
    title: 'Publish to TikTok / Reels / Shorts & Track Revenue',
    desc: 'Post manually or queue via Auto-Publish, pin your /api/r/... link, and monitor verified clicks and affiliate commissions.',
    cta: 'Open Publish Queue',
    href: '/dashboard/publish/queue',
  },
] as const;

const ROUTE_MAP_VI = [
  { goal: 'Làm nhanh 1 video + link affiliate đầu tiên (Khuyên dùng)', tool: 'Affiliate Studio (4 Bước)', href: '/dashboard/first-value' },
  { goal: 'Xây kênh YouTube dài hạn (Chiến lược, Lịch đăng, Analytics)', tool: 'YouTube Factory Suite', href: '/dashboard/youtube' },
  { goal: 'Hẹn giờ & tự động đăng hàng loạt đa nền tảng', tool: 'Publish Queue', href: '/dashboard/publish/queue' },
  { goal: 'Chạy chiến dịch AI nhiều bước + Duyệt bài tự động', tool: 'AI Missions', href: '/dashboard/missions' },
] as const;

const ROUTE_MAP_EN = [
  { goal: 'Ship your first affiliate video + shortlink fast (Recommended)', tool: 'Affiliate Studio (4 Steps)', href: '/dashboard/first-value' },
  { goal: 'Run a long-term YouTube channel (Strategy, Calendar, Analytics)', tool: 'YouTube Factory Suite', href: '/dashboard/youtube' },
  { goal: 'Schedule & auto-publish across social channels', tool: 'Publish Queue', href: '/dashboard/publish/queue' },
  { goal: 'Run multi-step autonomous AI campaigns & approvals', tool: 'AI Missions', href: '/dashboard/missions' },
] as const;

export function GuideQuickstart2026({ locale }: GuideQuickstart2026Props) {
  const isVi = locale === 'vi';
  const steps = isVi ? STEPS_VI : STEPS_EN;
  const routes = isVi ? ROUTE_MAP_VI : ROUTE_MAP_EN;

  return (
    <section
      data-testid="guide-quickstart-2026"
      className="mb-12 rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {isVi ? 'Cầm tay chỉ việc 5 phút • Cập nhật 2026' : '5-Minute Hands-On Quickstart • 2026'}
          </p>
          <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {isVi
              ? '5 bước ra Video & Link Affiliate đầu tiên'
              : '5 Steps to Your First Affiliate Video & Shortlink'}
          </h2>
        </div>
        <Link
          href="/dashboard/first-value"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <span>{isVi ? 'Bắt đầu ngay' : 'Start Now'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((item) => (
          <li
            key={item.step}
            className="flex flex-col justify-between rounded-xl border border-border bg-background/60 p-4"
          >
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">STEP {item.step}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
            <Link
              href={item.href}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>{item.cta}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
          <Compass className="h-4 w-4 text-primary" />
          <span>{isVi ? 'Bản đồ nhanh: Khi nào dùng mục nào?' : 'Quick Map: Which Tool for Which Goal?'}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {routes.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary/50"
            >
              <span className="text-muted-foreground">{row.goal}</span>
              <span className="shrink-0 font-semibold text-primary">{row.tool} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
