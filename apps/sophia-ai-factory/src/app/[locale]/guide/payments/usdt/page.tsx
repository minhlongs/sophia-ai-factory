import { Metadata } from "next";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/lib/seo/schema-org";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Payments", url: `${SITE_URL}/guide/payments` },
  { name: "USDT", url: `${SITE_URL}/guide/payments/usdt` },
]);

export const metadata: Metadata = {
  title: "Pay with USDT (Crypto) — Sophia AI Factory Guide",
  description:
    "Step-by-step guide to paying with USDT cryptocurrency on Sophia AI Factory. Supports TRC-20, ERC-20, and BEP-20 networks.",
};

const steps = [
  {
    step: 1,
    title: "Choose Your Plan / Chọn Gói Của Bạn",
    description:
      "Go to the pricing page and select the tier that fits your business: BASIC, PREMIUM, ENTERPRISE, or MASTER lifetime.",
  },
  {
    step: 2,
    title: "Select Crypto Payment / Chọn Thanh Toán Crypto",
    description:
      'On the checkout screen, click "Pay with Crypto (USDT)". You will be redirected to the NOWPayments secure page.',
  },
  {
    step: 3,
    title: "Send USDT / Gửi USDT",
    description:
      "Copy the wallet address or scan the QR code with your crypto wallet app. Send the EXACT amount shown — no more, no less.",
  },
  {
    step: 4,
    title: "Wait for Confirmation / Chờ Xác Nhận",
    description:
      "NOWPayments processes your transaction (typically 5–30 minutes). Your tier activates automatically once confirmed — no manual steps needed.",
  },
];

const networks = [
  { name: "TRC-20 (Tron)", badge: "Lowest Fees", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { name: "ERC-20 (Ethereum)", badge: "Most Common", color: "text-blue-400", bg: "bg-blue-500/10" },
  { name: "BEP-20 (BSC)", badge: "Fast", color: "text-amber-400", bg: "bg-amber-500/10" },
];

export default function UsdtPaymentGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Pay with USDT (Crypto)
          <span className="block text-xl mt-1">Thanh Toán Bằng USDT (Crypto)</span>
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Simple, secure cryptocurrency payment.{" "}
          <span className="text-muted-foreground/70">Thanh toán tiền mã hóa đơn giản, an toàn.</span>
        </p>
      </div>

      {/* What is USDT */}
      <div className="bg-card/50 border border-border/40 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          What is USDT? / USDT Là Gì?
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          USDT (Tether) is a <strong className="text-foreground">stablecoin</strong> — a type of
          cryptocurrency always equal to 1 USD. Unlike Bitcoin or Ethereum, its value does not
          fluctuate. You do not need technical knowledge; just send USDT from any crypto wallet or
          exchange. USDT là loại tiền điện tử ổn định, luôn có giá trị bằng 1 USD, dễ sử dụng và
          không biến động như Bitcoin.
        </p>
      </div>

      {/* Steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-5">
          Step-by-Step / Hướng Dẫn Từng Bước
        </h2>
        <div className="space-y-4">
          {steps.map((s) => (
            <GuideStepCard
              key={s.step}
              step={s.step}
              title={s.title}
              description={s.description}
            />
          ))}
        </div>
      </div>

      <GuideCallout variant="warning" title="Important / Quan Trọng">
        Always send the <strong className="text-foreground">EXACT amount</strong> shown. Sending
        more or less may delay processing and require manual review.
      </GuideCallout>

      {/* Supported Networks */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Supported Networks / Mạng Được Hỗ Trợ
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {networks.map((n) => (
            <div
              key={n.name}
              className={`flex flex-col gap-1.5 border border-border/40 rounded-xl p-4 ${n.bg}`}
            >
              <span className="text-sm font-semibold text-foreground">{n.name}</span>
              <span className={`text-xs font-medium ${n.color}`}>{n.badge}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          TRC-20 recommended for lowest transaction fees / TRC-20 được khuyến nghị vì phí giao dịch thấp nhất.
        </p>
      </div>

      <GuideCallout variant="tip" title="Tip">
        Payment is processed by <strong className="text-foreground">NOWPayments</strong> — a
        trusted crypto payment provider used by thousands of businesses worldwide.
      </GuideCallout>

      {/* Next links */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { href: "/guide/payments/vnd", label: "VND Bank Transfer" },
          { href: "/guide/payments/plans", label: "Plans & Pricing Guide" },
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
