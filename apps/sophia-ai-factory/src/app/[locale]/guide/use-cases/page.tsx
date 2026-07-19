import { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, ShoppingBag, Home, ArrowRight } from "lucide-react";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Use Cases", url: `${SITE_URL}/guide/use-cases` },
]);

export const metadata: Metadata = {
  title: "Use Case Library — Sophia AI Factory Guide",
  description:
    "See how businesses use Sophia AI Factory to grow revenue with AI video. CEO marketing, e-commerce, real estate, and more.",
};

const USE_CASES = [
  {
    href: "/guide/use-cases/ceo-marketing",
    icon: TrendingUp,
    iconColor: "text-primary-400",
    iconBg: "bg-primary-500/10",
    gradientFrom: "from-primary/20",
    gradientTo: "to-primary/5",
    title: "CEO Video Marketing",
    titleVi: "Video Marketing Cho CEO",
    description: "Create weekly YouTube content without hiring a video team",
    descriptionVi: "Tạo nội dung YouTube mỗi tuần mà không cần thuê đội quay phim",
    roi: "Save $500–2000/video",
  },
  {
    href: "/guide/use-cases/ecommerce",
    icon: ShoppingBag,
    iconColor: "text-accent-400",
    iconBg: "bg-accent-500/10",
    gradientFrom: "from-accent/20",
    gradientTo: "to-accent/5",
    title: "E-commerce Product Videos",
    titleVi: "Video Sản Phẩm TMĐT",
    description: "50+ product demos per month at $0 production cost",
    descriptionVi: "50+ video demo sản phẩm mỗi tháng với chi phí $0",
    roi: "50+ videos/month",
  },
  {
    href: "/guide/use-cases/real-estate",
    icon: Home,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    gradientFrom: "from-emerald-500/20",
    gradientTo: "to-emerald-500/5",
    title: "Real Estate Virtual Tours",
    titleVi: "Video Bất Động Sản",
    description: "Video walkthrough for every listing — no cameraman needed",
    descriptionVi: "Video giới thiệu cho mỗi bất động sản — không cần quay thực",
    roi: "403% more inquiries",
  },
];

export default function UseCasesIndexPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
          Use Case Library / Thư Viện Ứng Dụng Thực Tế
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          See how businesses use Sophia to grow revenue with AI video.{" "}
          <span className="text-muted-foreground/70">
            — Xem cách doanh nghiệp dùng Sophia để tăng doanh thu bằng video AI.
          </span>
        </p>
      </div>

      {/* Use case cards */}
      <div className="grid sm:grid-cols-1 gap-4">
        {USE_CASES.map((uc) => {
          const Icon = uc.icon;
          return (
            <Link
              key={uc.href}
              href={uc.href}
              className={`group relative block rounded-xl border border-border/40 bg-gradient-to-br ${uc.gradientFrom} ${uc.gradientTo} p-6 hover:border-border/70 transition-all duration-200 hover:shadow-lg hover:shadow-black/20`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`shrink-0 w-12 h-12 rounded-xl ${uc.iconBg} flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 ${uc.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-foreground mb-0.5">
                        {uc.title}
                      </h2>
                      <p className="text-xs text-muted-foreground/70 mb-2">{uc.titleVi}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                      {uc.roi}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{uc.description}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{uc.descriptionVi}</p>
                </div>
                <ArrowRight className="shrink-0 w-5 h-5 text-muted-foreground/30 group-hover:text-muted-foreground/70 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Back to guide */}
      <div>
        <Link
          href="/guide"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Guide / Về Hướng Dẫn
        </Link>
      </div>
    </div>
  );
}
