import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/lib/seo/schema-org";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Use Cases", url: `${SITE_URL}/guide/use-cases` },
  { name: "CEO Marketing", url: `${SITE_URL}/guide/use-cases/ceo-marketing` },
]);

export const metadata: Metadata = {
  title: "Non-Tech CEO Video Marketing — Sophia AI Factory",
  description:
    "How non-technical CEOs create weekly YouTube content with AI video — no video team, no technical skills, $0 production cost.",
};

const STEPS = [
  {
    step: 1,
    title: "Write Your Topic / Nhập Chủ Đề",
    description:
      'Enter what you want to talk about (e.g., "5 leadership lessons from 10 years building a business"). No script needed — just the idea.',
  },
  {
    step: 2,
    title: "AI Creates Script / AI Viết Kịch Bản",
    description:
      "OpenRouter AI analyzes your topic and writes a professional video script in seconds. Optimized for viewer retention and YouTube SEO.",
  },
  {
    step: 3,
    title: "AI Generates Video / AI Tạo Video",
    description:
      "ElevenLabs converts the script to natural-sounding voice. D-ID creates an AI avatar presenter. Your polished video is assembled automatically.",
  },
  {
    step: 4,
    title: "Publish & Repeat / Đăng & Lặp Lại",
    description:
      "Download your MP4, upload to YouTube or TikTok, set a weekly schedule. Repeat every week — the process takes under 10 minutes.",
  },
];

const RESULTS = [
  { label: "4 videos/week production capacity", labelVi: "4 video mỗi tuần" },
  {
    label: "$0 production cost (vs. $500–2,000/video with agency)",
    labelVi: "$0 chi phí sản xuất (so với $500–2.000/video khi thuê)",
  },
  { label: "No technical skills needed", labelVi: "Không cần kỹ năng kỹ thuật" },
  { label: "Available 24/7 via Telegram bot", labelVi: "Sẵn sàng 24/7 qua Telegram bot" },
];

export default function CeoMarketingPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Non-Tech CEO Video Marketing
        </h1>
        <p className="text-sm text-muted-foreground/70 mb-3">
          Video Marketing Cho CEO Không Biết Kỹ Thuật
        </p>
        <p className="text-muted-foreground leading-relaxed">
          You want weekly YouTube content but can&apos;t afford a video team — and you don&apos;t
          have time to learn video production. Sophia automates the entire pipeline so you focus on
          your ideas, not the tools.
        </p>
      </div>

      {/* Workflow */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          How It Works / Quy Trình Thực Hiện
        </h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <GuideStepCard
              key={s.step}
              step={s.step}
              title={s.title}
              description={s.description}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Results / Kết Quả Thực Tế</h2>
        <div className="bg-card/50 border border-border/40 rounded-xl p-6 space-y-3">
          {RESULTS.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground/60">{r.labelVi}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <GuideCallout variant="tip" title="Quick Start">
        Most CEOs create their first video in under 10 minutes. —{" "}
        <span className="text-muted-foreground/70">
          Hầu hết CEO tạo video đầu tiên trong chưa đến 10 phút.
        </span>
      </GuideCallout>

      {/* CTA */}
      <div className="bg-gradient-to-br from-violet-500/10 to-cyan-500/5 border border-border/40 rounded-xl p-6">
        <p className="text-sm font-medium text-foreground mb-1">
          Ready to start? / Sẵn sàng bắt đầu?
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Follow the Quick Start guide to create your first video in minutes.
        </p>
        <Link
          href="/guide/first-video"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Quick Start Guide →
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Link
          href="/guide/use-cases"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All Use Cases
        </Link>
        <Link
          href="/guide/use-cases/ecommerce"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          E-commerce Videos →
        </Link>
      </div>
    </div>
  );
}
