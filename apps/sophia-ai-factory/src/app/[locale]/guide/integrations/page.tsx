import { Metadata } from "next";
import { Brain, Mic, Video, Database, CreditCard, Bot } from "lucide-react";
import { GuideStepCard } from "@/components/guide/guide-step-card";
import { GuideCallout } from "@/components/guide/guide-callout";
import { GuideFeatureGrid, GuideFeatureItem } from "@/components/guide/guide-feature-grid";
import { YouTubeEmbed } from "@/components/guide/youtube-embed";

export const metadata: Metadata = {
  title: "Tích Hợp Dịch Vụ — Hướng Dẫn Sophia AI Factory",
  description: "Hướng dẫn kết nối OpenRouter, ElevenLabs, D-ID, Cloudflare D1, NOWPayments và Telegram Bot",
};

const services: GuideFeatureItem[] = [
  {
    icon: Brain,
    title: "OpenRouter — Viết Kịch Bản AI",
    description: "Cung cấp trí tuệ nhân tạo để viết kịch bản video tự động, tối ưu cho từng sản phẩm.",
    iconColor: "text-cyan-400",
  },
  {
    icon: Mic,
    title: "ElevenLabs — Giọng Nói AI",
    description: "Chuyển kịch bản thành giọng nói tự nhiên với hàng chục giọng tiếng Việt và Anh.",
    iconColor: "text-blue-400",
  },
  {
    icon: Video,
    title: "D-ID — Avatar Video",
    description: "Tạo người dẫn ảo AI trình bày nội dung video, không cần quay camera thật.",
    iconColor: "text-violet-400",
  },
  {
    icon: Database,
    title: "Cloudflare D1 — Cơ Sở Dữ Liệu",
    description: "Lưu trữ dữ liệu chiến dịch, API keys và cấu hình hệ thống. Chạy trên edge, tốc độ cao.",
    iconColor: "text-emerald-400",
  },
  {
    icon: CreditCard,
    title: "NOWPayments — Thanh Toán Crypto",
    description: "Nhận thanh toán bằng tiền điện tử (USDT, BTC...) từ khách hàng toàn cầu.",
    iconColor: "text-amber-400",
  },
  {
    icon: Bot,
    title: "Telegram Bot — Điều Khiển Từ Xa",
    description: "Tạo và theo dõi chiến dịch video ngay trên Telegram, không cần mở trình duyệt.",
    iconColor: "text-sky-400",
  },
];

export default function IntegrationsGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Tích Hợp Dịch Vụ
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Sophia kết nối 6 dịch vụ bên ngoài để tự động hoá toàn bộ quy trình sản xuất video.
          Mỗi dịch vụ chỉ cần thiết lập <strong className="text-foreground">1 lần duy nhất</strong>.
        </p>
      </div>

      {/* Overview grid */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Tổng Quan 6 Dịch Vụ</h2>
        <GuideFeatureGrid features={services} columns={3} />
      </div>

      {/* OpenRouter */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Brain className="w-5 h-5 text-cyan-400" /> OpenRouter — Não AI Viết Kịch Bản
        </h2>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Chi Phí</div>
            <div className="text-foreground">Miễn phí ban đầu, trả theo dùng</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Thời Gian Thiết Lập</div>
            <div className="text-foreground">2 phút</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Video Hướng Dẫn</div>
            <div className="text-foreground">Có (xem bên dưới)</div>
          </div>
        </div>

        <YouTubeEmbed videoId="VvJvJ0uXiVQ" title="How to Use AI Models API for Free | OpenRouter Tutorial" />

        <div className="space-y-3">
          <GuideStepCard step={1} title="Truy cập openrouter.ai" description="Mở trình duyệt và vào trang openrouter.ai" />
          <GuideStepCard step={2} title="Đăng ký tài khoản" description='Nhấn "Sign Up" và dùng email để đăng ký miễn phí.' />
          <GuideStepCard step={3} title="Tạo API Key" description='Sau khi đăng nhập, nhấn tên bạn → "Keys" → "Create Key" → đặt tên "Sophia".' />
          <GuideStepCard step={4} title="Dán vào Sophia" description="Sao chép key → vào Sophia Cài Đặt → API Keys → OpenRouter → Lưu." />
        </div>
      </section>

      {/* ElevenLabs */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Mic className="w-5 h-5 text-blue-400" /> ElevenLabs — Giọng Nói AI
        </h2>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Chi Phí</div>
            <div className="text-foreground">Miễn phí 10.000 ký tự/tháng</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Gói Trả Phí</div>
            <div className="text-foreground">Từ $5/tháng</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Thời Gian Thiết Lập</div>
            <div className="text-foreground">2 phút</div>
          </div>
        </div>

        <YouTubeEmbed videoId="WBnywbB_4Lk" title="How To Use Eleven Labs API" />

        <div className="space-y-3">
          <GuideStepCard step={1} title="Truy cập elevenlabs.io" description="Vào trang elevenlabs.io và đăng ký tài khoản miễn phí." />
          <GuideStepCard step={2} title="Lấy API Key" description='Sau khi đăng nhập, nhấn ảnh đại diện → "Profile + API key" → sao chép key.' />
          <GuideStepCard step={3} title="Dán vào Sophia" description="Vào Sophia Cài Đặt → API Keys → ElevenLabs → dán key → Lưu." />
        </div>
      </section>

      {/* D-ID */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Video className="w-5 h-5 text-violet-400" /> D-ID — Avatar Video AI
        </h2>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Chi Phí</div>
            <div className="text-foreground">Dùng thử miễn phí</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Gói Trả Phí</div>
            <div className="text-foreground">Từ $5.9/tháng</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 px-4 py-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Thời Gian Thiết Lập</div>
            <div className="text-foreground">3 phút</div>
          </div>
        </div>

        <div className="space-y-3">
          <GuideStepCard step={1} title="Truy cập studio.d-id.com" description='Vào studio.d-id.com và nhấn "Start Free Trial".' />
          <GuideStepCard step={2} title="Lấy API Key" description="Sau khi đăng nhập, nhấn ảnh đại diện → Settings → API → sao chép D-ID API key." />
          <GuideStepCard step={3} title="Dán vào Sophia" description="Vào Sophia Cài Đặt → API Keys → D-ID → dán key → Lưu." />
        </div>
      </section>

      {/* Supabase */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" /> Cloudflare D1 — Cơ Sở Dữ Liệu
        </h2>
        <GuideCallout variant="info">
          Cơ sở dữ liệu được Sophia cấu hình sẵn trên Cloudflare D1 (edge database). Bạn không cần thiết lập gì thêm — dữ liệu của bạn
          được lưu và bảo mật tự động.
        </GuideCallout>
      </section>

      {/* NOWPayments */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-400" /> NOWPayments — Thanh Toán Crypto
        </h2>
        <GuideCallout variant="tip">
          NOWPayments cho phép nhận USDT, BTC và nhiều loại tiền điện tử khác. Liên hệ hỗ trợ
          để kích hoạt tính năng này nếu bạn muốn thanh toán bằng crypto.
        </GuideCallout>
      </section>

      {/* Telegram Bot */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bot className="w-5 h-5 text-sky-400" /> Telegram Bot — Điều Khiển Từ Xa
        </h2>
        <GuideCallout variant="important">
          Xem hướng dẫn chi tiết tại trang{" "}
          <a href="/guide/telegram" className="underline text-violet-300 hover:text-violet-200">
            Kết Nối Telegram Bot
          </a>{" "}
          — tích hợp này cho phép tạo và theo dõi chiến dịch ngay trên điện thoại.
        </GuideCallout>
        <div className="space-y-3">
          <GuideStepCard
            step={1}
            title="Tìm bot trên Telegram"
            description="Mở Telegram và tìm kiếm @Sophia_Bbot"
            code="@Sophia_Bbot"
          />
          <GuideStepCard
            step={2}
            title="Kích hoạt bot"
            description='Nhấn "Start" hoặc gõ /start để kết nối tài khoản Sophia của bạn.'
          />
          <GuideStepCard
            step={3}
            title="Sử dụng lệnh"
            description="Dùng /campaign để tạo chiến dịch, /status để kiểm tra tiến độ, /results để xem kết quả."
          />
        </div>
      </section>
    </div>
  );
}
