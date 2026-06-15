/**
 * /dashboard/help/sops — Comprehensive SOP Operations Guide.
 *
 * Bilingual (EN/VI) guide covering the full SOP lifecycle:
 * 1. Browse & Install from Marketplace
 * 2. Configure (playbook, config form)
 * 3. Run (manual, webhook, cron)
 * 4. View Results (run history, timeline)
 * 5. Create Custom SOPs (MASTER only)
 * 6. Challenges & Rewards
 *
 * @module app/[locale]/dashboard/help/sops/page
 */

import Link from 'next/link';
import {
  Store, BookOpen, Play, BarChart2, Sparkles, Target,
  Webhook, Clock, Settings, ArrowRight, CheckCircle, AlertCircle,
} from 'lucide-react';

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata = {
  title: 'SOP Operations Guide | Sophia AI',
  description: 'Complete guide to browsing, installing, running, and creating SOPs',
};

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  intro: string;
  steps: Array<{ title: string; desc: string; link?: string; linkLabel?: string }>;
  tip?: string;
}

const ICON_CLS = 'w-5 h-5 shrink-0';

const SECTIONS_EN: Section[] = [
  {
    id: 'browse-install',
    icon: <Store className={ICON_CLS} />,
    title: '1. Browse & Install SOPs',
    intro: 'SOPs are automation playbooks — pre-built workflows that generate videos, manage content, or run analytics automatically.',
    steps: [
      {
        title: 'Open SOP Marketplace',
        desc: 'Go to SOP Marketplace from the sidebar. Browse 30+ official and community SOPs by category.',
        link: '/dashboard/sop-marketplace',
        linkLabel: 'Open Marketplace',
      },
      {
        title: 'Preview a SOP',
        desc: 'Click any SOP card to see its description, steps, required inputs, and pricing. Official SOPs are free.',
      },
      {
        title: 'Install',
        desc: 'Click "Install" (or "Purchase" for community SOPs). The SOP appears in your "My SOPs" page instantly.',
        link: '/dashboard/sops',
        linkLabel: 'View My SOPs',
      },
    ],
    tip: 'Start with the "Video Generation Starter" SOP — it\'s pre-installed for all users and demonstrates the full workflow.',
  },
  {
    id: 'configure',
    icon: <Settings className={ICON_CLS} />,
    title: '2. Configure Your SOP',
    intro: 'Each installed SOP can be customized before running.',
    steps: [
      {
        title: 'Open SOP Detail',
        desc: 'Click any installed SOP in "My SOPs" to open its detail page with tabs: Overview, Runs, Edit, Webhook.',
      },
      {
        title: 'Edit Configuration',
        desc: 'Go to the "Edit" tab. Fill in the configuration form (niche, language, style, etc.). Each SOP has different options.',
      },
      {
        title: 'Customize Playbook (Advanced)',
        desc: 'The playbook is the step-by-step instruction set. Advanced users can edit the playbook markdown to change the SOP\'s behavior.',
      },
    ],
    tip: 'You can always reset to the default configuration by re-installing the SOP.',
  },
  {
    id: 'run',
    icon: <Play className={ICON_CLS} />,
    title: '3. Run SOPs',
    intro: 'Three ways to trigger a SOP run:',
    steps: [
      {
        title: 'Manual Run',
        desc: 'Click "Run Now" on the SOP detail page (Overview tab). The SOP executes immediately and you can watch progress in real-time.',
      },
      {
        title: 'Webhook Trigger',
        desc: 'Go to the "Webhook" tab to get your webhook URL and secret. Send a POST request to trigger the SOP from external tools (Zapier, Make, n8n, etc.).',
      },
      {
        title: 'Scheduled (Cron)',
        desc: 'Some SOPs support automatic scheduling. When enabled, the server runs the SOP on a set schedule (e.g., daily at 6 AM). Check the SOP description for scheduling support.',
      },
    ],
    tip: 'Webhook format: POST to the webhook URL with header "x-sop-secret: YOUR_SECRET". Body is optional JSON with input overrides.',
  },
  {
    id: 'results',
    icon: <BarChart2 className={ICON_CLS} />,
    title: '4. View Results & History',
    intro: 'Track every SOP execution with detailed logs.',
    steps: [
      {
        title: 'Run History',
        desc: 'Go to the "Runs" tab on any SOP detail page. See all past runs with trigger type (manual/webhook/cron), status, start time, and duration.',
      },
      {
        title: 'Run Detail & Timeline',
        desc: 'Click "View Mission →" on any run to see the step-by-step execution timeline. Each step shows its status, output, and timing.',
      },
      {
        title: 'Run Statuses',
        desc: 'Pending = queued, Running = in progress, Completed = success, Failed = error occurred. Failed runs show error details in the timeline.',
      },
    ],
  },
  {
    id: 'create',
    icon: <Sparkles className={ICON_CLS} />,
    title: '5. Create Custom SOPs (MASTER)',
    intro: 'MASTER-tier users can create and sell custom SOPs on the marketplace.',
    steps: [
      {
        title: 'Open SOP Creator',
        desc: 'Go to "SOP Creator" in the sidebar (MASTER only). Click "Create New SOP".',
        link: '/dashboard/sop-creator',
        linkLabel: 'Open SOP Creator',
      },
      {
        title: 'Define Your SOP',
        desc: 'Fill in the name (EN + VI), category, description, and playbook. The playbook defines each step the SOP will execute.',
      },
      {
        title: 'Set Pricing',
        desc: 'Free or paid. For paid SOPs, set a price and earn commission on every sale through the marketplace.',
      },
      {
        title: 'Publish',
        desc: 'Save as draft to test, then publish to make it available on the marketplace for all users.',
      },
    ],
    tip: 'Test your SOP thoroughly before publishing. Install it yourself first and run it to verify all steps work correctly.',
  },
  {
    id: 'challenges',
    icon: <Target className={ICON_CLS} />,
    title: '6. Challenges & Rewards',
    intro: 'Complete challenges to earn rewards and boost your earnings.',
    steps: [
      {
        title: 'View Active Challenges',
        desc: 'Go to "Challenges" in the sidebar. See all active challenges with progress bars and deadlines.',
        link: '/dashboard/challenges',
        linkLabel: 'View Challenges',
      },
      {
        title: 'Track Progress',
        desc: 'Each challenge tracks your progress automatically. Run SOPs, make sales, or earn commission to advance.',
      },
      {
        title: 'Claim Rewards',
        desc: 'When you complete a challenge, claim your reward: badges, MCU credits, or commission boosts.',
      },
    ],
    tip: 'Challenges refresh periodically. Check back regularly for new opportunities.',
  },
];

const SECTIONS_VI: Section[] = [
  {
    id: 'browse-install',
    icon: <Store className={ICON_CLS} />,
    title: '1. Duyệt & Cài Đặt SOP',
    intro: 'SOP là các quy trình tự động hóa — workflow được xây dựng sẵn giúp tạo video, quản lý nội dung, hoặc chạy phân tích tự động.',
    steps: [
      {
        title: 'Mở Kho SOP',
        desc: 'Vào "Kho SOP" từ thanh bên. Duyệt hơn 30 SOP chính thức và cộng đồng theo danh mục.',
        link: '/dashboard/sop-marketplace',
        linkLabel: 'Mở Kho SOP',
      },
      {
        title: 'Xem trước SOP',
        desc: 'Nhấn vào bất kỳ thẻ SOP nào để xem mô tả, các bước, đầu vào cần thiết và giá.',
      },
      {
        title: 'Cài đặt',
        desc: 'Nhấn "Cài đặt" (hoặc "Mua" với SOP cộng đồng). SOP sẽ xuất hiện ngay trong trang "SOP Của Tôi".',
        link: '/dashboard/sops',
        linkLabel: 'Xem SOP Của Tôi',
      },
    ],
    tip: 'Bắt đầu với SOP "Tạo Video" — nó được cài sẵn cho tất cả người dùng và minh họa toàn bộ quy trình.',
  },
  {
    id: 'configure',
    icon: <Settings className={ICON_CLS} />,
    title: '2. Cấu Hình SOP',
    intro: 'Mỗi SOP đã cài có thể tùy chỉnh trước khi chạy.',
    steps: [
      {
        title: 'Mở Chi Tiết SOP',
        desc: 'Nhấn vào bất kỳ SOP đã cài trong "SOP Của Tôi" để mở trang chi tiết với các tab: Tổng Quan, Lịch Sử, Chỉnh Sửa, Webhook.',
      },
      {
        title: 'Chỉnh Sửa Cấu Hình',
        desc: 'Vào tab "Chỉnh Sửa". Điền form cấu hình (ngách, ngôn ngữ, phong cách, v.v.). Mỗi SOP có tùy chọn khác nhau.',
      },
      {
        title: 'Tùy Chỉnh Playbook (Nâng Cao)',
        desc: 'Playbook là bộ hướng dẫn từng bước. Người dùng nâng cao có thể sửa playbook markdown để thay đổi hành vi của SOP.',
      },
    ],
    tip: 'Bạn luôn có thể đặt lại cấu hình mặc định bằng cách cài lại SOP.',
  },
  {
    id: 'run',
    icon: <Play className={ICON_CLS} />,
    title: '3. Chạy SOP',
    intro: 'Ba cách kích hoạt SOP:',
    steps: [
      {
        title: 'Chạy Thủ Công',
        desc: 'Nhấn "Chạy Ngay" trên trang chi tiết SOP (tab Tổng Quan). SOP chạy ngay lập tức và bạn có thể theo dõi tiến trình.',
      },
      {
        title: 'Kích Hoạt Qua Webhook',
        desc: 'Vào tab "Webhook" để lấy URL webhook và mã bí mật. Gửi yêu cầu POST để kích hoạt SOP từ công cụ bên ngoài (Zapier, Make, n8n...).',
      },
      {
        title: 'Lên Lịch (Cron)',
        desc: 'Một số SOP hỗ trợ chạy tự động theo lịch. Khi được bật, server chạy SOP theo lịch cố định (ví dụ: mỗi ngày lúc 6 giờ sáng).',
      },
    ],
    tip: 'Webhook: POST đến URL webhook với header "x-sop-secret: MÃ_BÍ_MẬT". Body là JSON tùy chọn.',
  },
  {
    id: 'results',
    icon: <BarChart2 className={ICON_CLS} />,
    title: '4. Xem Kết Quả & Lịch Sử',
    intro: 'Theo dõi mọi lần chạy SOP với log chi tiết.',
    steps: [
      {
        title: 'Lịch Sử Chạy',
        desc: 'Vào tab "Lịch Sử" trên trang chi tiết SOP. Xem tất cả lần chạy với loại kích hoạt, trạng thái, thời gian bắt đầu và thời lượng.',
      },
      {
        title: 'Chi Tiết & Timeline',
        desc: 'Nhấn "Xem Chi Tiết →" để xem timeline từng bước. Mỗi bước hiển thị trạng thái, kết quả và thời gian.',
      },
      {
        title: 'Trạng Thái Chạy',
        desc: 'Đang chờ = xếp hàng, Đang chạy = đang xử lý, Hoàn thành = thành công, Thất bại = có lỗi. Lần chạy thất bại hiển thị chi tiết lỗi.',
      },
    ],
  },
  {
    id: 'create',
    icon: <Sparkles className={ICON_CLS} />,
    title: '5. Tạo SOP Tùy Chỉnh (MASTER)',
    intro: 'Người dùng MASTER có thể tạo và bán SOP trên marketplace.',
    steps: [
      {
        title: 'Mở Tạo SOP',
        desc: 'Vào "Tạo SOP" trong thanh bên (chỉ MASTER). Nhấn "Tạo SOP Mới".',
        link: '/dashboard/sop-creator',
        linkLabel: 'Mở Tạo SOP',
      },
      {
        title: 'Định Nghĩa SOP',
        desc: 'Điền tên (EN + VI), danh mục, mô tả và playbook. Playbook định nghĩa từng bước SOP sẽ thực thi.',
      },
      {
        title: 'Đặt Giá',
        desc: 'Miễn phí hoặc có phí. Với SOP có phí, đặt giá và nhận hoa hồng cho mỗi lần bán trên marketplace.',
      },
      {
        title: 'Xuất Bản',
        desc: 'Lưu bản nháp để thử nghiệm, sau đó xuất bản để mọi người dùng có thể truy cập trên marketplace.',
      },
    ],
    tip: 'Thử nghiệm kỹ SOP trước khi xuất bản. Cài đặt và chạy thử trước để xác nhận tất cả các bước hoạt động.',
  },
  {
    id: 'challenges',
    icon: <Target className={ICON_CLS} />,
    title: '6. Thử Thách & Phần Thưởng',
    intro: 'Hoàn thành thử thách để nhận phần thưởng và tăng thu nhập.',
    steps: [
      {
        title: 'Xem Thử Thách',
        desc: 'Vào "Thử Thách" trong thanh bên. Xem tất cả thử thách đang hoạt động với thanh tiến trình và hạn chót.',
        link: '/dashboard/challenges',
        linkLabel: 'Xem Thử Thách',
      },
      {
        title: 'Theo Dõi Tiến Trình',
        desc: 'Mỗi thử thách tự động theo dõi tiến trình. Chạy SOP, bán hàng, hoặc kiếm hoa hồng để tiến bộ.',
      },
      {
        title: 'Nhận Phần Thưởng',
        desc: 'Khi hoàn thành thử thách, nhận phần thưởng: huy hiệu, MCU credits, hoặc tăng hoa hồng.',
      },
    ],
    tip: 'Thử thách được làm mới định kỳ. Kiểm tra thường xuyên để không bỏ lỡ cơ hội.',
  },
];

export default async function SopHelpPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale.startsWith('vi');
  const sections = isVi ? SECTIONS_VI : SECTIONS_EN;
  const pageTitle = isVi ? 'Hướng Dẫn Vận Hành SOP' : 'SOP Operations Guide';
  const pageSubtitle = isVi
    ? 'Hướng dẫn đầy đủ để duyệt, cài đặt, chạy và tạo SOP'
    : 'Complete guide to browsing, installing, running, and creating SOPs';
  const toc = isVi ? 'Mục Lục' : 'Table of Contents';

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {isVi ? 'Trung Tâm Trợ Giúp' : 'Help Center'}
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-1 ring-violet-500/30">
            <BookOpen className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{toc}</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/30"
            >
              {s.icon}
              <span>{s.title}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-4 scroll-mt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400">
              {section.icon}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{section.intro}</p>

          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-card/50 p-4 hover:border-border/80 transition-colors"
              >
                <div className="shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="font-medium text-foreground text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  {step.link && (
                    <Link
                      href={step.link}
                      className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      {step.linkLabel} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {section.tip && (
            <div className="flex gap-3 rounded-lg bg-accent-500/5 border border-accent-500/20 p-3">
              <AlertCircle className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
              <p className="text-xs text-accent-300/80 leading-relaxed">
                <span className="font-semibold">Tip:</span> {section.tip}
              </p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
