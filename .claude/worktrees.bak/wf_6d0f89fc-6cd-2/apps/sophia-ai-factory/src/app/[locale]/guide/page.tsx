import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, MessageCircle } from "lucide-react";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Hướng Dẫn Bắt Đầu — Sophia AI Factory",
  description: "Hướng dẫn từng bước sử dụng Sophia AI Factory",
};

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Bắt Đầu Với Sophia
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Làm theo 5 bước đơn giản dưới đây để tạo video AI đầu tiên của bạn.
          Bạn không cần biết kỹ thuật — Sophia xử lý mọi thứ tự động.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Các Bước Thiết Lập</h2>

        <GuideStepCard
          step={1}
          title="Truy Cập Dashboard"
          description={
            <span>
              Mở trình duyệt và vào{" "}
              <span className="font-mono text-accent-400 text-xs bg-accent-500/10 px-1.5 py-0.5 rounded">
                sophia.agencyos.network
              </span>
              . Nhấn <strong className="text-foreground">Đăng Nhập</strong> ở góc trên bên phải,
              nhập email và mật khẩu đã đăng ký.
            </span>
          }
        />

        <GuideCallout variant="tip">
          Chưa có tài khoản? Nhấn <strong className="text-foreground">Đăng Ký</strong> và làm theo hướng dẫn — chỉ mất 2 phút.
        </GuideCallout>

        <GuideStepCard
          step={2}
          title="Thiết Lập API Keys"
          description={
            <span>
              Sophia cần 3 API keys để tạo video: <strong className="text-foreground">OpenRouter</strong> (viết kịch bản AI),{" "}
              <strong className="text-foreground">ElevenLabs</strong> (giọng nói AI), và{" "}
              <strong className="text-foreground">D-ID</strong> (video avatar). Vào{" "}
              <strong className="text-foreground">Cài Đặt → API Keys</strong> để nhập.
            </span>
          }
        />

        <GuideCallout variant="info">
          Mỗi dịch vụ có gói miễn phí để bắt đầu. API Keys chỉ cần nhập <strong className="text-foreground">1 lần duy nhất</strong> và được mã hóa an toàn.
        </GuideCallout>

        <GuideStepCard
          step={3}
          title="Tạo Chiến Dịch Đầu Tiên"
          description={
            <span>
              Trong Dashboard, nhấn nút{" "}
              <strong className="text-foreground">+ Tạo Chiến Dịch Mới</strong>.
              Nhập tên chiến dịch, chọn mẫu video, nhập nội dung chính và chọn giọng nói.
              Nhấn <strong className="text-foreground">Tạo Chiến Dịch</strong>.
            </span>
          }
        />

        <GuideStepCard
          step={4}
          title="Xem Và Tải Video"
          description={
            <span>
              Video xử lý trong <strong className="text-foreground">2–5 phút</strong>.
              Khi trạng thái hiển thị <strong className="text-accent-400">Hoàn Thành</strong>,
              nhấn vào chiến dịch để xem trước và tải file MP4 về máy.
            </span>
          }
        />

        <GuideStepCard
          step={5}
          title="Cần Hỗ Trợ?"
          description={
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-accent-400" aria-hidden="true" />
                <span>Telegram: <span className="font-mono text-accent-400 text-xs">@Sophia_Bbot</span></span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary-400" aria-hidden="true" />
                <span>Email: <span className="font-mono text-primary-400 text-xs">support@mekongmind.com</span></span>
              </div>
            </div>
          }
        />
      </div>

      {/* Next steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Bước Tiếp Theo</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { href: "/guide/telegram", label: "Kết nối Telegram Bot", desc: "Tạo video từ điện thoại" },
            { href: "/guide/how-it-works", label: "Cách Hoạt Động", desc: "Hiểu quy trình của Sophia" },
            { href: "/guide/faq", label: "Câu Hỏi Thường Gặp", desc: "Giải đáp thắc mắc" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-card/50 border border-border/40 rounded-xl p-4 hover:border-primary-500/40 hover:bg-primary-500/5 transition-colors"
            >
              <div className="text-sm font-medium text-foreground group-hover:text-primary-300 transition-colors flex items-center gap-1.5">
                {item.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
