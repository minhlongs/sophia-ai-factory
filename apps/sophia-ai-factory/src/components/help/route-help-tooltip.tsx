/**
 * route-help-tooltip.tsx
 * Server component wrapper: pre-fetches video metadata from D1, then renders
 * the client HelpTooltip with all data baked in (no client-side fetch).
 *
 * Usage (one line in any server page):
 *   <RouteHelpTooltip locale={locale} routeKey="dashboard" />
 *
 * @module components/help/route-help-tooltip
 */

import { getHelpVideoForTooltip } from "@/forest/help/help-video-store";
import { HelpTooltip, type HelpTooltipContent } from "./help-tooltip";

// ---------------------------------------------------------------------------
// Per-route tooltip content config
// ---------------------------------------------------------------------------

type RouteKey =
  | "dashboard"
  | "byok"
  | "sops"
  | "sop-marketplace"
  | "sop-creator"
  | "challenges"
  | "analytics"
  | "credits"
  | "affiliate-networks";

interface RouteConfig {
  introEn: string;
  introVi: string;
  videoSlug?: string;
  pageLabelEn: string;
  pageLabelVi: string;
}

const ROUTE_CONFIG: Record<RouteKey, RouteConfig> = {
  dashboard: {
    pageLabelEn: "Dashboard",
    pageLabelVi: "Bảng điều khiển",
    introEn:
      "Your command center. Check daily stats, resume campaigns, and see what needs attention. New here? Complete the setup steps above to unlock your first AI video.",
    introVi:
      "Trung tâm điều hành của bạn. Kiểm tra số liệu hàng ngày, tiếp tục chiến dịch và xem điều gì cần chú ý. Mới ở đây? Hoàn thành các bước thiết lập phía trên để mở khóa video AI đầu tiên.",
    videoSlug: "welcome",
  },
  byok: {
    pageLabelEn: "API Keys",
    pageLabelVi: "Khóa API",
    introEn:
      "BYOK (Bring Your Own Key): add your OpenRouter, ElevenLabs, and D-ID credentials here. Sophia will use your quota — no platform usage fees once your keys are active.",
    introVi:
      "BYOK (Mang theo khóa của bạn): thêm thông tin xác thực OpenRouter, ElevenLabs và D-ID tại đây. Sophia sẽ dùng quota của bạn — không tính phí sử dụng nền tảng khi khóa của bạn đã hoạt động.",
    videoSlug: "setup-byok-keys",
  },
  sops: {
    pageLabelEn: "SOPs",
    pageLabelVi: "SOP",
    introEn:
      "SOPs (Standard Operating Procedures) are your video templates. Install from the marketplace, then run them to generate AI videos on demand. Each SOP has its own script, voice, and avatar settings.",
    introVi:
      "SOP (Quy trình vận hành chuẩn) là các mẫu video của bạn. Cài đặt từ marketplace, sau đó chạy để tạo video AI theo yêu cầu. Mỗi SOP có kịch bản, giọng nói và cài đặt avatar riêng.",
    videoSlug: "create-first-video",
  },
  analytics: {
    pageLabelEn: "Analytics",
    pageLabelVi: "Phân tích",
    introEn:
      "Track your revenue, commissions, and video performance. Use the date range picker to compare periods. Revenue numbers update every hour from your affiliate network data.",
    introVi:
      "Theo dõi doanh thu, hoa hồng và hiệu suất video. Dùng bộ chọn khoảng thời gian để so sánh các giai đoạn. Số liệu doanh thu cập nhật mỗi giờ từ dữ liệu mạng lưới affiliate của bạn.",
    videoSlug: "read-revenue-dashboard",
  },
  credits: {
    pageLabelEn: "Credits",
    pageLabelVi: "Credits",
    introEn:
      "MCU Credits power your AI video generation. Each video run costs credits based on duration and model. Top up via the billing page or earn credits through the affiliate program.",
    introVi:
      "MCU Credits cấp năng lượng cho việc tạo video AI của bạn. Mỗi lần chạy video tốn credits tùy thuộc vào thời lượng và mô hình. Nạp thêm qua trang thanh toán hoặc kiếm credits qua chương trình affiliate.",
    videoSlug: "read-revenue-dashboard",
  },
  "affiliate-networks": {
    pageLabelEn: "Affiliate Networks",
    pageLabelVi: "Mạng lưới Affiliate",
    introEn:
      "Connect your affiliate network accounts (Awin, ShareASale, Impact, etc.). Each network requires your personal API credentials — these are never shared with other users.",
    introVi:
      "Kết nối tài khoản mạng lưới affiliate của bạn (Awin, ShareASale, Impact, v.v.). Mỗi mạng lưới yêu cầu thông tin xác thực API cá nhân của bạn — không bao giờ chia sẻ với người dùng khác.",
    videoSlug: "connect-first-affiliate",
  },
  "sop-marketplace": {
    pageLabelEn: "SOP Marketplace",
    pageLabelVi: "Kho SOP",
    introEn:
      "Browse 30+ automation playbooks. Install official SOPs for free or purchase community-created SOPs. Each SOP automates a specific workflow like TikTok posting, YouTube SEO, or Pinterest affiliate.",
    introVi:
      "Duyệt hơn 30 playbook tự động hóa. Cài SOP chính thức miễn phí hoặc mua SOP do cộng đồng tạo. Mỗi SOP tự động hóa một quy trình cụ thể như đăng TikTok, SEO YouTube, hoặc affiliate Pinterest.",
  },
  "sop-creator": {
    pageLabelEn: "SOP Creator",
    pageLabelVi: "Tạo SOP",
    introEn:
      "Create custom SOPs and sell them on the marketplace. Define playbook steps, set pricing, and earn commission on every sale. MASTER-tier exclusive.",
    introVi:
      "Tạo SOP tùy chỉnh và bán trên marketplace. Định nghĩa các bước playbook, đặt giá và nhận hoa hồng cho mỗi lần bán. Dành riêng cho MASTER.",
  },
  challenges: {
    pageLabelEn: "Challenges",
    pageLabelVi: "Thử Thách",
    introEn:
      "Complete challenges to earn badges, MCU credits, and commission boosts. Challenges refresh periodically — check back regularly for new opportunities to grow.",
    introVi:
      "Hoàn thành thử thách để nhận huy hiệu, MCU credits và tăng hoa hồng. Thử thách được làm mới định kỳ — kiểm tra thường xuyên để không bỏ lỡ cơ hội.",
  },
};

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

interface Props {
  locale: string;
  routeKey: RouteKey;
}

export async function RouteHelpTooltip({ locale, routeKey }: Props) {
  const config = ROUTE_CONFIG[routeKey];
  const isVi = locale.startsWith("vi");

  // Pre-fetch video metadata (may be null if table doesn't exist yet)
  let videoPublished = false;
  let videoTitleEn: string | undefined;
  let videoTitleVi: string | undefined;

  if (config.videoSlug) {
    try {
      const video = await getHelpVideoForTooltip(config.videoSlug);
      if (video) {
        videoPublished = video.published === 1;
        videoTitleEn = video.title_en;
        videoTitleVi = video.title_vi;
      }
    } catch {
      // Table not yet applied — silently degrade (no video link shown)
    }
  }

  const content: HelpTooltipContent = {
    introEn: config.introEn,
    introVi: config.introVi,
    videoSlug: config.videoSlug,
    videoPublished,
    videoTitleEn,
    videoTitleVi,
  };

  const pageLabel = isVi ? config.pageLabelVi : config.pageLabelEn;

  return (
    <HelpTooltip locale={locale} content={content} pageLabel={pageLabel} />
  );
}
