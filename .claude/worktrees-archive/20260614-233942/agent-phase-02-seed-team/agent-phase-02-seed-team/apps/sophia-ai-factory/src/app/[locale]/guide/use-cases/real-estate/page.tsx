import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Use Cases", url: `${SITE_URL}/guide/use-cases` },
  { name: "Real Estate", url: `${SITE_URL}/guide/use-cases/real-estate` },
]);

export const metadata: Metadata = {
  title: "Real Estate Virtual Tours — Sophia AI Factory",
  description:
    "Create AI-narrated virtual tour videos for every property listing. Get 403% more buyer inquiries without hiring a videographer.",
};

const STEPS = [
  {
    step: 1,
    title: "Describe the Property / Mô Tả Bất Động Sản",
    description:
      "Enter the address, key features, and selling points (location, area, bedrooms, special amenities). Use the same info from your listing.",
  },
  {
    step: 2,
    title: "AI Writes Narration / AI Viết Lời Thuyết Minh",
    description:
      "OpenRouter AI creates a professional property narration script — highlighting strengths, neighborhood benefits, and investment potential.",
  },
  {
    step: 3,
    title: "Virtual Tour Created / Video Tham Quan Được Tạo",
    description:
      "AI voice narrates the tour while D-ID creates an engaging presenter video. Buyers experience a guided walkthrough without visiting in person.",
  },
  {
    step: 4,
    title: "Share with Buyers / Chia Sẻ Với Người Mua",
    description:
      "Embed on your listing website, share via Zalo or email to interested buyers, post on Facebook — any property, any platform, immediately.",
  },
];

const RESULTS = [
  {
    label: "Every listing has a video walkthrough",
    labelVi: "Mỗi bất động sản đều có video giới thiệu",
  },
  {
    label: "$0 videography cost per listing",
    labelVi: "$0 chi phí quay phim cho mỗi căn",
  },
  {
    label: "Faster time-to-sale from stronger buyer interest",
    labelVi: "Rút ngắn thời gian bán nhờ thu hút người mua tốt hơn",
  },
  {
    label: "Stand out from competitors with video-first listings",
    labelVi: "Nổi bật hơn đối thủ với listing ưu tiên video",
  },
];

export default function RealEstatePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Real Estate Virtual Tours
        </h1>
        <p className="text-sm text-muted-foreground/70 mb-3">Video Bất Động Sản Thực Tế Ảo</p>
        <p className="text-muted-foreground leading-relaxed">
          Listings with video get{" "}
          <span className="text-foreground font-medium">403% more inquiries</span>, but filming
          every property is expensive and time-consuming. Sophia creates AI-narrated virtual tours
          for every listing — in minutes, at zero cost.
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

      <GuideCallout variant="tip" title="Best Practice">
        Add the Sophia video link directly to your listing on Batdongsan.com.vn or any property
        portal. Listings with video appear higher in search results.{" "}
        <span className="text-muted-foreground/60">
          — Thêm link video vào listing BatDongSan.com.vn để xuất hiện cao hơn trên kết quả tìm
          kiếm.
        </span>
      </GuideCallout>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Link
          href="/guide/use-cases/ecommerce"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← E-commerce Videos
        </Link>
        <Link
          href="/guide/use-cases"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          All Use Cases →
        </Link>
      </div>
    </div>
  );
}
