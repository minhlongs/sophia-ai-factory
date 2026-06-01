import { Metadata } from "next";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Payments", url: `${SITE_URL}/guide/payments` },
  { name: "Plans", url: `${SITE_URL}/guide/payments/plans` },
]);

export const metadata: Metadata = {
  title: "Plans & Pricing Guide — Sophia AI Factory",
  description:
    "Compare Sophia AI Factory plans: BASIC $199/mo, PREMIUM $399/mo, ENTERPRISE $799/mo, MASTER $4,999 lifetime. Annual plans save 17%.",
};

const plans = [
  {
    name: "BASIC",
    monthly: "$199/mo",
    annual: "$1,990/yr",
    savings: "Save $398/yr",
    badge: "Getting Started",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    fit: "Just getting started, testing AI video content for your business.",
  },
  {
    name: "PREMIUM",
    monthly: "$399/mo",
    annual: "$3,990/yr",
    savings: "Save $798/yr",
    badge: "Most Popular",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/40",
    fit: "Growing business with regular content production needs.",
  },
  {
    name: "ENTERPRISE",
    monthly: "$799/mo",
    annual: "$7,990/yr",
    savings: "Save $1,598/yr",
    badge: "High Volume",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    fit: "High volume output, team use, and priority support.",
  },
  {
    name: "MASTER",
    monthly: "$4,999",
    annual: "Lifetime",
    savings: "No annual needed",
    badge: "Best Value",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    fit: "One-time investment — lifetime access to all features, forever.",
  },
];

export default function PlansGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Plans & Pricing Guide
          <span className="block text-xl mt-1">Hướng Dẫn Gói & Bảng Giá</span>
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Find the right plan for your business. Annual plans save 17% vs monthly billing.
        </p>
      </div>

      {/* Pricing table */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Bảng Giá / Pricing</h2>
        <div className="border border-border/40 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 bg-muted/30 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
            <span>Plan</span>
            <span>Monthly</span>
            <span>Annual</span>
            <span>Annual Savings</span>
          </div>
          {plans.map((p, i) => (
            <div
              key={p.name}
              className={`grid grid-cols-4 px-4 py-3.5 text-sm border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors ${i === 3 ? "bg-emerald-500/5" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className={`font-bold ${p.color}`}>{p.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full w-fit ${p.bg} ${p.color}`}>
                  {p.badge}
                </span>
              </div>
              <span className="font-semibold text-foreground self-center">{p.monthly}</span>
              <span className="text-muted-foreground self-center">{p.annual}</span>
              <span className={`text-xs font-medium self-center ${p.color}`}>{p.savings}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Which plan is right */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Which Plan Is Right for You? / Gói Nào Phù Hợp?
        </h2>
        <div className="space-y-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex gap-4 border rounded-xl p-4 ${p.bg} ${p.border}`}
            >
              <span className={`text-sm font-bold shrink-0 w-24 ${p.color}`}>{p.name}</span>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.fit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly vs Annual */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Monthly vs Annual / Hàng Tháng vs Hàng Năm
        </h2>
        <div className="bg-card/50 border border-border/40 rounded-xl p-5 space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Annual billing saves <strong className="text-foreground">17%</strong> compared to
            monthly — pay for 10 months, get 12.
          </p>
          <ul className="space-y-1.5 pl-4 list-disc">
            <li>
              <strong className="text-cyan-400">BASIC Annual:</strong> $1,990/yr (save $398 vs
              monthly)
            </li>
            <li>
              <strong className="text-violet-400">PREMIUM Annual:</strong> $3,990/yr (save $798 vs
              monthly)
            </li>
            <li>
              <strong className="text-blue-400">ENTERPRISE Annual:</strong> $7,990/yr (save
              $1,598 vs monthly)
            </li>
            <li>
              <strong className="text-emerald-400">MASTER Lifetime:</strong> $4,999 once — no
              recurring cost ever.
            </li>
          </ul>
        </div>
      </div>

      <GuideCallout variant="tip" title="Not Sure? / Chưa Chắc Chắn?">
        Start with <strong className="text-foreground">BASIC</strong> and upgrade anytime. Your
        data and settings carry over automatically. Bắt đầu với BASIC và nâng cấp bất kỳ lúc nào.
      </GuideCallout>

      {/* CTA + navigation */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Link
          href="/pricing"
          className="group flex items-center justify-between gap-2 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30 rounded-xl px-4 py-3 text-sm font-medium text-foreground hover:border-violet-500/50 transition-colors"
        >
          View Full Pricing
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        {[
          { href: "/guide/payments/usdt", label: "Pay with USDT" },
          { href: "/guide/payments/vnd", label: "VND Bank Transfer" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between gap-2 bg-card/50 border border-border/40 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
          >
            {item.label}
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
