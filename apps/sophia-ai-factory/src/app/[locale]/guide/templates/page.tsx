import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Campaign Templates", url: `${SITE_URL}/guide/templates` },
]);

export const metadata: Metadata = {
  title: "Campaign Templates — Sophia AI Factory",
  description:
    "Pre-built templates for popular content types. Save 50% setup time. / Mẫu chiến dịch có sẵn cho các loại nội dung phổ biến.",
};

const holidayTemplates = [
  { name: "Tết Nguyên Đán", desc: "New Year greetings + product promotions for Vietnamese lunar calendar." },
  { name: "Tết Trung Thu / Mid-Autumn Festival", desc: "Gift sets, mooncake promotions, family-oriented brand messaging." },
  { name: "Ngày Quốc Khánh / National Day", desc: "Patriotic brand content, seasonal sales, promotional announcements." },
];

const evergreenTemplates = [
  { name: "Product Review", desc: "Structured review format: intro → features → benefits → call-to-action." },
  { name: "Tutorial / How-To", desc: "Step-by-step instructional video for software, services, or physical products." },
  { name: "Top 5 Listicle", desc: "Engagement-optimized list format. Works for any product category." },
];

export default function TemplatesPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Campaign Templates
          <span className="block text-xl mt-1 text-muted-foreground font-normal">
            Mẫu Chiến Dịch
          </span>
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Pre-built templates for popular content types. /{" "}
          Mẫu có sẵn cho các loại nội dung phổ biến — bắt đầu nhanh hơn.
        </p>
      </div>

      {/* Vietnamese Holidays */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Vietnamese Holidays / Lễ Tết Việt Nam
        </h2>
        <div className="space-y-3">
          {holidayTemplates.map((t) => (
            <div
              key={t.name}
              className="bg-card/50 border border-border/40 rounded-xl px-5 py-4 hover:border-border/70 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground mb-1">
                {t.name}
              </div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Evergreen */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Evergreen Content / Nội Dung Luôn Phù Hợp
        </h2>
        <div className="space-y-3">
          {evergreenTemplates.map((t) => (
            <div
              key={t.name}
              className="bg-card/50 border border-border/40 rounded-xl px-5 py-4 hover:border-border/70 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground mb-1">
                {t.name}
              </div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How to use */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          How to Use a Template / Cách Dùng Mẫu
        </h2>

        <GuideStepCard
          step={1}
          title="Choose a Template / Chọn Mẫu"
          description={
            <span>
              On the Campaign creation screen, select a template from the{" "}
              <strong className="text-foreground">Template Library</strong>{" "}
              dropdown. /{" "}
              Trong màn hình tạo chiến dịch, chọn mẫu từ danh sách{" "}
              <strong className="text-foreground">Thư Viện Mẫu</strong>.
            </span>
          }
        />

        <GuideStepCard
          step={2}
          title="Customize Content / Tùy Chỉnh Nội Dung"
          description={
            <span>
              Change the product name, brand tone, and key selling points. The
              template provides structure — you provide the details. /{" "}
              Thay tên sản phẩm, giọng điệu thương hiệu và điểm bán hàng chính.
              Mẫu cung cấp cấu trúc — bạn cung cấp chi tiết.
            </span>
          }
        />

        <GuideStepCard
          step={3}
          title="Launch Campaign / Khởi Động Chiến Dịch"
          description={
            <span>
              Hit <strong className="text-foreground">Create Campaign</strong>.
              Sophia uses the template structure to generate a higher-quality
              script and video automatically. /{" "}
              Nhấn <strong className="text-foreground">Tạo Chiến Dịch</strong>.
              Sophia sử dụng cấu trúc mẫu để tạo kịch bản và video chất lượng
              cao hơn một cách tự động.
            </span>
          }
        />
      </div>

      <GuideCallout variant="tip">
        Templates save 50% of setup time compared to starting from scratch. /{" "}
        Mẫu tiết kiệm 50% thời gian thiết lập so với bắt đầu từ đầu.
      </GuideCallout>

      {/* Next steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Next Steps / Bước Tiếp Theo
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              href: "/guide/first-video",
              label: "First Video Guide",
              desc: "Start from the beginning",
            },
            {
              href: "/guide/telegram",
              label: "Telegram Bot",
              desc: "Create videos from your phone",
            },
            {
              href: "/guide/affiliate",
              label: "Earn Commission",
              desc: "Refer friends, earn 70%",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-card/50 border border-border/40 rounded-xl p-4 hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
            >
              <div className="text-sm font-medium text-foreground group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
                {item.label}
                <ArrowRight
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {item.desc}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
