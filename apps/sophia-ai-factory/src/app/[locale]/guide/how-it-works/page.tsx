import { Metadata } from "next";
import { ArrowRight, User, Brain, Mic, Video, ArrowDown } from "lucide-react";
import { GuideCallout } from "@/components/guide/guide-callout";
import { GuideFeatureGrid, GuideFeatureItem } from "@/components/guide/guide-feature-grid";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cách Hoạt Động — Hướng Dẫn Sophia AI Factory",
  description: "Bản đồ hành trình người dùng và quy trình làm việc của Sophia AI Video Factory",
};

const flowSteps = [
  { icon: User, label: "Bạn nhập nội dung", color: "text-violet-400", bg: "bg-violet-500/10" },
  { icon: Brain, label: "AI viết kịch bản", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { icon: Mic, label: "AI tạo giọng nói", color: "text-blue-400", bg: "bg-blue-500/10" },
  { icon: Video, label: "Video hoàn chỉnh", color: "text-emerald-400", bg: "bg-emerald-500/10" },
];

const features: GuideFeatureItem[] = [
  {
    icon: Brain,
    title: "OpenRouter — Viết Kịch Bản",
    description: "AI phân tích chủ đề và tự động viết kịch bản video chuyên nghiệp, tối ưu cho từng sản phẩm.",
    iconColor: "text-cyan-400",
  },
  {
    icon: Mic,
    title: "ElevenLabs — Giọng Nói AI",
    description: "Chuyển kịch bản thành giọng nói tự nhiên với hàng chục giọng nam/nữ tiếng Việt và Anh.",
    iconColor: "text-blue-400",
  },
  {
    icon: Video,
    title: "D-ID — Avatar Video",
    description: "Tạo người dẫn ảo AI (AI avatar) trình bày nội dung, không cần quay camera thật.",
    iconColor: "text-violet-400",
  },
  {
    icon: User,
    title: "Bạn Làm Chủ",
    description: "Video xuất bản trực tiếp lên kênh YouTube/TikTok của bạn. Bạn sở hữu 100% nội dung.",
    iconColor: "text-emerald-400",
  },
];

const timelineRows = [
  { step: "Đăng ký", time: "2 phút", freq: "1 lần duy nhất" },
  { step: "Thiết lập API Keys", time: "10 phút", freq: "1 lần duy nhất" },
  { step: "Tạo video mới", time: "2 phút nhập + 5 phút chờ", freq: "Mỗi chiến dịch" },
];

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Cách Sophia Hoạt Động
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Bạn chỉ cần nhập nội dung — Sophia kết hợp 3 dịch vụ AI để tạo video hoàn chỉnh tự động.
        </p>
      </div>

      {/* Visual flow */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-5">Luồng Xử Lý</h2>
        <div className="flex flex-col items-center gap-0">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex flex-col items-center">
                <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border border-border/40 bg-card/50 w-full max-w-sm ${step.bg}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step.bg}`}>
                    <Icon className={`w-4 h-4 ${step.color}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{step.label}</span>
                </div>
                {index < flowSteps.length - 1 && (
                  <ArrowDown className="w-5 h-5 text-muted-foreground/40 my-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature breakdown */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">4 Thành Phần Cốt Lõi</h2>
        <GuideFeatureGrid features={features} columns={2} />
      </div>

      <GuideCallout variant="important" title="MCU Credits">
        Mỗi video tạo ra tiêu thụ một lượng MCU (Media Credit Unit) nhất định tùy độ dài và độ phức tạp.
        Kiểm tra số dư MCU trong Dashboard ở mục <strong className="text-foreground">Tài Khoản</strong>.
      </GuideCallout>

      {/* Timeline */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Thời Gian Thực Tế</h2>
        <div className="border border-border/40 rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/30 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
            <span>Bước</span>
            <span>Thời Gian</span>
            <span>Tần Suất</span>
          </div>
          {timelineRows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-3 px-5 py-3 text-sm border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
            >
              <span className="font-medium text-foreground">{row.step}</span>
              <span className="text-muted-foreground">{row.time}</span>
              <span className="text-cyan-400 text-xs font-medium">{row.freq}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status colors */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Màu Trạng Thái</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { color: "bg-amber-500", label: "Đang xử lý" },
            { color: "bg-emerald-500", label: "Hoàn thành" },
            { color: "bg-red-500", label: "Có lỗi" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 bg-card/50 border border-border/40 rounded-lg px-4 py-2">
              <div className={`w-3 h-3 rounded-full ${s.color}`} />
              <span className="text-sm text-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next links */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { href: "/guide/screens", label: "Hướng Dẫn Màn Hình" },
          { href: "/guide/faq", label: "Câu Hỏi Thường Gặp" },
          { href: "/guide/telegram", label: "Telegram Bot" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between gap-2 bg-card/50 border border-border/40 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
          >
            {item.label}
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
