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
  { name: "E-commerce", url: `${SITE_URL}/guide/use-cases/ecommerce` },
]);

export const metadata: Metadata = {
  title: "E-commerce Product Videos — Sophia AI Factory",
  description:
    "Create 50+ product demo videos per month at zero cost. Boost Shopify and Amazon listings with AI-generated product showcase videos.",
};

const STEPS = [
  {
    step: 1,
    title: "Enter Product Details / Nhập Thông Tin Sản Phẩm",
    description:
      "Paste your product name, key features, and benefits. Use your existing product listing — no rewriting needed.",
  },
  {
    step: 2,
    title: "AI Creates Demo Script / AI Viết Kịch Bản Demo",
    description:
      "OpenRouter AI generates a professional product demo script that highlights selling points and drives purchase intent.",
  },
  {
    step: 3,
    title: "Video Generated / Video Được Tạo",
    description:
      "ElevenLabs voiceover + D-ID visuals create a polished product showcase automatically. Ready to download in minutes.",
  },
  {
    step: 4,
    title: "Use Everywhere / Dùng Ở Mọi Nơi",
    description:
      "Embed on Shopify product pages, upload to Amazon listings, share on social media, use in paid ads — one video, multiple channels.",
  },
];

const RESULTS = [
  { label: "50+ product videos per month", labelVi: "50+ video sản phẩm mỗi tháng" },
  {
    label: "Consistent brand voice across all products",
    labelVi: "Giọng điệu thương hiệu nhất quán trên tất cả sản phẩm",
  },
  {
    label: "Multi-language support for international markets",
    labelVi: "Hỗ trợ đa ngôn ngữ cho thị trường quốc tế",
  },
  { label: "Scale without hiring", labelVi: "Mở rộng quy mô mà không cần tuyển dụng" },
];

export default function EcommercePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent mb-3">
          E-commerce Product Videos
        </h1>
        <p className="text-sm text-muted-foreground/70 mb-3">
          Video Sản Phẩm Thương Mại Điện Tử
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Product listings with video get{" "}
          <span className="text-foreground font-medium">80% more engagement</span>, but creating
          videos is expensive and time-consuming. Sophia lets you produce professional product demos
          at scale — without a production budget.
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

      <GuideCallout variant="info" title="Pro Tip">
        Start with your top 10 best-selling products. Create videos for those first, measure
        conversion lift, then scale to your full catalog.{" "}
        <span className="text-muted-foreground/60">
          — Bắt đầu với 10 sản phẩm bán chạy nhất, đo lường kết quả, sau đó mở rộng.
        </span>
      </GuideCallout>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Link
          href="/guide/use-cases/ceo-marketing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← CEO Marketing
        </Link>
        <Link
          href="/guide/use-cases/real-estate"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Real Estate Tours →
        </Link>
      </div>
    </div>
  );
}
