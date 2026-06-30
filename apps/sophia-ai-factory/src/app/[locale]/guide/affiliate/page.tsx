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
  { name: "Affiliate Program", url: `${SITE_URL}/guide/affiliate` },
]);

export const metadata: Metadata = {
  title: "Earn 70% Commission — Sophia AI Factory Affiliate Program",
  description:
    "Refer friends to Sophia AI Factory and earn 70% commission on their first payment. / Giới thiệu bạn bè và kiếm 70% hoa hồng từ khoản thanh toán đầu tiên của họ.",
};

const commissionRows = [
  { tier: "BASIC", monthly: "$199", earning: "$139.30" },
  { tier: "PREMIUM", monthly: "$399", earning: "$279.30" },
  { tier: "ENTERPRISE", monthly: "$799", earning: "$559.30" },
  { tier: "MASTER", monthly: "$4,999", earning: "$3,499.30" },
];

export default function AffiliatePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Earn 70% Commission
          <span className="block text-xl mt-1 text-muted-foreground font-normal">
            Kiếm 70% Hoa Hồng
          </span>
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Refer friends, earn passive income. /{" "}
          Giới thiệu bạn bè và kiếm thu nhập thụ động.
        </p>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          How It Works / Cách Hoạt Động
        </h2>

        <GuideStepCard
          step={1}
          title="Get Your Link / Lấy Liên Kết Của Bạn"
          description={
            <span>
              Find your unique referral link in{" "}
              <strong className="text-foreground">
                Dashboard → Affiliate
              </strong>
              . Each link is tied to your account. /{" "}
              Tìm liên kết giới thiệu duy nhất của bạn trong{" "}
              <strong className="text-foreground">
                Dashboard → Liên Kết Giới Thiệu
              </strong>
              .
            </span>
          }
        />

        <GuideStepCard
          step={2}
          title="Share It / Chia Sẻ"
          description={
            <span>
              Share your referral link on social media, email, or your website.
              Anyone who signs up through your link is tracked automatically. /{" "}
              Chia sẻ liên kết trên mạng xã hội, email hoặc website của bạn.
              Mọi người đăng ký qua liên kết của bạn đều được ghi nhận tự động.
            </span>
          }
        />

        <GuideStepCard
          step={3}
          title="Earn Commission / Kiếm Hoa Hồng"
          description={
            <span>
              Get <strong className="text-foreground">70% commission</strong>{" "}
              of the first payment from each referral. The more you refer, the
              more you earn. /{" "}
              Nhận <strong className="text-foreground">70% hoa hồng</strong>{" "}
              từ khoản thanh toán đầu tiên của mỗi người được giới thiệu.
            </span>
          }
        />
      </div>

      {/* Commission table */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Commission Table / Bảng Hoa Hồng
        </h2>
        <div className="border border-border/40 rounded-xl overflow-x-auto">
          <div className="grid grid-cols-3 bg-muted/30 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
            <span>Tier / Gói</span>
            <span>Monthly / Tháng</span>
            <span>Your Earning / Hoa Hồng</span>
          </div>
          {commissionRows.map((row, i) => (
            <div
              key={row.tier}
              className={`grid grid-cols-3 px-5 py-3 text-sm transition-colors hover:bg-muted/20 ${
                i < commissionRows.length - 1 ? "border-b border-border/30" : ""
              }`}
            >
              <span className="font-semibold text-foreground">{row.tier}</span>
              <span className="text-muted-foreground">{row.monthly}</span>
              <span className="text-emerald-400 font-bold">{row.earning}</span>
            </div>
          ))}
        </div>
      </div>

      <GuideCallout variant="tip">
        Commissions are paid out via your dashboard once approved. /{" "}
        Hoa hồng được thanh toán qua dashboard của bạn sau khi được phê duyệt.
      </GuideCallout>

      {/* CTA */}
      <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-primary-500/20 rounded-xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-2">
          Ready to Start? / Sẵn Sàng Bắt Đầu?
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Go to your Affiliate dashboard to get your referral link now. /{" "}
          Vào trang Affiliate để lấy liên kết giới thiệu ngay bây giờ.
        </p>
        <Link
          href="/affiliate"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Go to Affiliate Dashboard
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Next steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          More Guides / Hướng Dẫn Khác
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              href: "/guide/first-video",
              label: "First Video Guide",
              desc: "Create your first AI video",
            },
            {
              href: "/guide/templates",
              label: "Campaign Templates",
              desc: "Save time with pre-built templates",
            },
            {
              href: "/guide/payments/plans",
              label: "Pricing Plans",
              desc: "See all subscription tiers",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-card/50 border border-border/40 rounded-xl p-4 hover:border-primary-500/40 hover:bg-primary-500/5 transition-colors"
            >
              <div className="text-sm font-medium text-foreground group-hover:text-primary-300 transition-colors flex items-center gap-1.5">
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
