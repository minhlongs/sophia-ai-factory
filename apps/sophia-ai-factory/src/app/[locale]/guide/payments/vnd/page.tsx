import { Metadata } from "next";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
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
  { name: "VND", url: `${SITE_URL}/guide/payments/vnd` },
]);

export const metadata: Metadata = {
  title: "VND Bank Transfer — Sophia AI Factory Guide",
  description:
    "Hướng dẫn thanh toán chuyển khoản VND qua PayOS cho người dùng Việt Nam. Hỗ trợ Vietcombank, Techcombank, MB Bank và 40+ ngân hàng.",
};

const steps = [
  {
    step: 1,
    title: "Choose Your Plan / Chọn Gói Của Bạn",
    description:
      "Truy cập trang Pricing và chọn gói phù hợp với doanh nghiệp của bạn: BASIC, PREMIUM, ENTERPRISE, hoặc MASTER trọn đời.",
  },
  {
    step: 2,
    title: "Select VND Payment / Chọn Thanh Toán VND",
    description:
      'Trên màn hình thanh toán, nhấn "Chuyển khoản VND". Bạn sẽ được chuyển đến trang thanh toán bảo mật của PayOS.',
  },
  {
    step: 3,
    title: "Scan QR Code / Quét Mã QR",
    description:
      "Mở ứng dụng ngân hàng trên điện thoại, chọn chức năng quét mã QR và quét mã hiển thị trên màn hình.",
  },
  {
    step: 4,
    title: "Transfer Exact Amount / Chuyển Đúng Số Tiền",
    description:
      "Nhập đúng số tiền VND hiển thị và xác nhận giao dịch trong ứng dụng ngân hàng. Không thay đổi nội dung chuyển khoản.",
  },
  {
    step: 5,
    title: "Automatic Confirmation / Xác Nhận Tự Động",
    description:
      "PayOS xác minh giao dịch ngay lập tức. Gói dịch vụ của bạn được kích hoạt tự động — không cần chờ đợi hay liên hệ hỗ trợ.",
  },
];

const banks = [
  "Vietcombank",
  "Techcombank",
  "MB Bank",
  "TPBank",
  "ACB",
  "BIDV",
  "VietinBank",
  "Agribank",
];

export default function VndPaymentGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
          Pay with VND Bank Transfer
          <span className="block text-xl mt-1">Thanh Toán Chuyển Khoản VND</span>
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          For Vietnam users — pay directly from your bank.{" "}
          <span className="text-muted-foreground/70">
            Dành cho người dùng Việt Nam — chuyển khoản trực tiếp từ ngân hàng của bạn.
          </span>
        </p>
      </div>

      <GuideCallout variant="info" title="Vietnam Only / Chỉ Dành Cho Việt Nam">
        This option is only available for Vietnam-based users. Tùy chọn này chỉ dành cho người
        dùng tại Việt Nam. International users should use{" "}
        <Link href="/guide/payments/usdt" className="text-accent-400 hover:underline">
          USDT crypto payment
        </Link>
        .
      </GuideCallout>

      {/* Steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-5">
          Hướng Dẫn Từng Bước / Step-by-Step
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

      {/* Supported Banks */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Ngân Hàng Được Hỗ Trợ / Supported Banks
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {banks.map((bank) => (
            <span
              key={bank}
              className="text-xs font-medium bg-card/50 border border-border/40 rounded-lg px-3 py-1.5 text-muted-foreground"
            >
              {bank}
            </span>
          ))}
          <span className="text-xs font-medium bg-muted/30 border border-border/30 rounded-lg px-3 py-1.5 text-muted-foreground/60">
            + 40 ngân hàng khác
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Hỗ trợ tất cả ngân hàng liên kết với hệ thống PayOS tại Việt Nam.
        </p>
      </div>

      <GuideCallout variant="tip" title="Nhanh Nhất / Fastest">
        VND payment is the fastest option — usually confirmed within{" "}
        <strong className="text-foreground">1–2 minutes</strong>. Thanh toán VND thường được xác
        nhận trong vòng 1–2 phút.
      </GuideCallout>

      {/* Next links */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { href: "/guide/payments/usdt", label: "Pay with USDT (Crypto)" },
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
