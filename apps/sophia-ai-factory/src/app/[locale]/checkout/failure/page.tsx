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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Hero card */}
        <div className="rounded-2xl border border-red-500/20 bg-white/[0.03] backdrop-blur-sm p-8 text-center shadow-2xl">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-white">
            {isVi ? "Thanh toán không thành công" : "Payment Unsuccessful"}
          </h1>

          <p className="text-zinc-400 text-sm">
            {isVi
              ? "Rất tiếc, thanh toán của bạn không thể hoàn tất. Đừng lo — bạn có thể thử lại."
              : "We're sorry, your payment could not be completed. Don't worry — you can try again."}
          </p>
        </div>

        {/* Common reasons */}
        <div className="rounded-2xl border border-zinc-800 bg-white/[0.02] p-6">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            {isVi ? "Nguyên nhân phổ biến" : "Common reasons"}
          </h2>
          <ul className="space-y-2">
            {reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="text-zinc-600 mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-center font-semibold text-white transition hover:from-violet-500 hover:to-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
            {isVi ? "Thử lại" : "Try again"}
          </Link>
          <a
            href="mailto:support@sophia.agencyos.network"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-700 px-6 py-3.5 text-center font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {isVi ? "Liên hệ hỗ trợ" : "Contact support"}
          </a>
        </div>

        {orderId && (
          <p className="text-center text-xs text-zinc-600">
            {isVi ? "Mã đơn hàng:" : "Order ID:"} {orderId}
          </p>
        )}
      </div>
    </div>
  );
}
