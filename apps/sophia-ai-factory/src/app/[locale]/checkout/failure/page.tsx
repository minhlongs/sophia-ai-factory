import type { Metadata } from "next";
import Link from "next/link";
import { XCircle, RefreshCw, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment Unsuccessful — Sophia AI Factory",
  description: "Your payment could not be completed. Please try again.",
};

interface CheckoutFailurePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderId?: string }>;
}

export default async function CheckoutFailurePage({
  params,
  searchParams,
}: CheckoutFailurePageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const orderId = sp.orderId ?? '';
  const isVi = locale?.startsWith('vi') ?? true;

  const reasons = isVi
    ? [
        "Số tiền thanh toán không đủ (underpayment)",
        "Giao dịch hết hạn trước khi xác nhận",
        "Số tiền không khớp với hóa đơn",
        "Lỗi kết nối blockchain",
      ]
    : [
        "Insufficient payment amount (underpayment)",
        "Transaction expired before confirmation",
        "Amount doesn't match the invoice",
        "Blockchain connection error",
      ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Hero card */}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center shadow-lg">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 border border-destructive/30">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {isVi ? "Thanh toán không thành công" : "Payment Unsuccessful"}
          </h1>

          <p className="text-muted-foreground text-sm">
            {isVi
              ? "Rất tiếc, thanh toán của bạn không thể hoàn tất. Đừng lo — bạn có thể thử lại."
              : "We're sorry, your payment could not be completed. Don't worry — you can try again."}
          </p>
        </div>

        {/* Common reasons */}
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wider text-sm">
            {isVi ? "Nguyên nhân phổ biến" : "Common reasons"}
          </h2>
          <ul className="space-y-2">
            {reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground/60 mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-center font-semibold text-primary-foreground transition hover:from-primary/90 hover:to-accent/90"
          >
            <RefreshCw className="h-4 w-4" />
            {isVi ? "Thử lại" : "Try again"}
          </Link>
          <a
            href="mailto:support@mekongmind.com"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border px-6 py-3.5 text-center font-medium text-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {isVi ? "Liên hệ hỗ trợ" : "Contact support"}
          </a>
        </div>

        {orderId && (
          <p className="text-center text-xs text-muted-foreground/60">
            {isVi ? "Mã đơn hàng:" : "Order ID:"} {orderId}
          </p>
        )}
      </div>
    </div>
  );
}
