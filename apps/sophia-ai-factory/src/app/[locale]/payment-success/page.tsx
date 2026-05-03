import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle, Mail, KeyRound, PlayCircle, BarChart3 } from "lucide-react";
import { getOrderById } from "@/land/orders/pending-order-repo";
import { PaymentStatusPoller } from "@/forest/components/checkout/payment-status-poller";

export const metadata: Metadata = {
  title: "Payment Confirmed — Sophia AI Factory",
  description: "Your payment has been received. Your account is being set up.",
};

interface PaymentSuccessPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tier?: string;
    sku?: string;
    order_id?: string;
    email?: string;
    via?: string;
    code?: string;
    trial_days?: string;
  }>;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 4))}@${domain}`;
}

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: PaymentSuccessPageProps) {
  const { locale } = await params;
  const sp = await searchParams;

  const isVi = locale?.startsWith("vi") ?? true;
  const tier = sp.tier ?? sp.sku ?? "BASIC";
  const orderId = sp.order_id ?? "";
  const rawEmail = sp.email ? decodeURIComponent(sp.email) : "";
  const maskedEmail = rawEmail ? maskEmail(rawEmail) : "";
  const viaPromo = sp.via === "promo";
  const promoCode = sp.code ?? "";
  const trialDays = sp.trial_days ? parseInt(sp.trial_days) : 0;

  // Status-aware rendering: poll pending_orders if order_id present
  let orderStatus: 'pending' | 'completed' | 'failed' | null = null;
  if (orderId.startsWith('sophia_')) {
    try {
      const order = await getOrderById(orderId);
      orderStatus = order ? (order.status === 'expired' ? 'failed' : order.status as 'pending' | 'completed' | 'failed') : null;
    } catch { /* non-fatal — show success UI */ }
  }

  // Redirect failed orders to failure page
  if (orderStatus === 'failed') {
    redirect(`/${locale}/checkout/failure?orderId=${encodeURIComponent(orderId)}`);
  }

  const tierNames: Record<string, string> = {
    BASIC: isVi ? "Starter (199$/tháng)" : "Starter ($199/mo)",
    PREMIUM: isVi ? "Growth (399$/tháng)" : "Growth ($399/mo)",
    ENTERPRISE: isVi ? "Premium (799$/tháng)" : "Premium ($799/mo)",
    MASTER: isVi ? "Master (4.999$/trọn đời)" : "Master ($4,999/lifetime)",
  };
  const tierName = tierNames[tier] ?? tier;

  const steps = isVi
    ? [
        { icon: Mail, label: "Kiểm tra email", desc: "Magic link đã được gửi — click để vào Sophia ngay" },
        { icon: KeyRound, label: "Thiết lập API keys", desc: "Settings → API Keys → thêm HeyGen & Resend (10 phút)" },
        { icon: PlayCircle, label: "Bật SOP đầu tiên", desc: "Dashboard → SOPs → Enable → Run Now" },
        { icon: BarChart3, label: "Xem kết quả", desc: "Dashboard → Videos để xem video AI của bạn" },
      ]
    : [
        { icon: Mail, label: "Check your email", desc: "We just sent a magic link — click it to access Sophia" },
        { icon: KeyRound, label: "Set up API keys", desc: "Settings → API Keys → add HeyGen & Resend (10 min)" },
        { icon: PlayCircle, label: "Enable first SOP", desc: "Dashboard → SOPs → Enable → Run Now" },
        { icon: BarChart3, label: "Watch results", desc: "Dashboard → Videos to see your AI-generated content" },
      ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Status poller — shown when order is still pending */}
        {orderStatus === 'pending' && orderId && (
          <PaymentStatusPoller orderId={orderId} locale={locale} />
        )}

        {/* Hero card — shown when completed or no order tracking */}
        {(orderStatus === 'completed' || !orderStatus) && (
          <div className="rounded-2xl border border-emerald-500/20 bg-white/[0.03] backdrop-blur-sm p-8 text-center shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-white">
              {viaPromo
                ? isVi ? "Mã ưu đãi đã kích hoạt!" : "Promo Code Activated!"
                : isVi ? "Thanh toán xác nhận!" : "Payment Confirmed!"}
            </h1>

            {viaPromo && promoCode && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-mono font-semibold text-violet-300">
                {promoCode}
              </div>
            )}

            <p className="mb-1 text-zinc-400 text-sm">
              {isVi ? "Gói" : "Plan"}:{" "}
              <span className="font-semibold text-emerald-400">
                {trialDays > 0
                  ? isVi ? `Dùng thử ${trialDays} ngày` : `${trialDays}-day free trial`
                  : tierName}
              </span>
            </p>

            {maskedEmail && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3">
                <p className="text-sm text-blue-300">
                  {isVi ? `Magic link đã gửi đến ` : `Magic link sent to `}
                  <span className="font-mono font-semibold text-blue-200">{maskedEmail}</span>
                </p>
              </div>
            )}

            {!maskedEmail && (
              <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3">
                <p className="text-sm text-zinc-400">
                  {isVi
                    ? "Kiểm tra email để nhận magic link đăng nhập."
                    : "Check your email for a magic login link."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Next steps — only when confirmed */}
        {(orderStatus === 'completed' || !orderStatus) && (
          <div className="rounded-2xl border border-zinc-800 bg-white/[0.02] backdrop-blur-sm p-6">
            <h2 className="mb-4 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              {isVi ? "Bước tiếp theo" : "What happens next"}
            </h2>
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 border border-violet-500/20 mt-0.5">
                    <step.icon className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      <span className="text-violet-400 mr-1.5">{i + 1}.</span>
                      {step.label}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions — only when confirmed */}
        {(orderStatus === 'completed' || !orderStatus) && (
          <div className="flex flex-col gap-3">
            <a
              href={`/${locale}/dashboard`}
              className="inline-block w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-center font-semibold text-white transition hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/20"
            >
              {isVi ? "Vào Dashboard" : "Go to Dashboard"}
            </a>
            <a
              href={`/${locale}/dashboard/settings`}
              className="inline-block w-full rounded-xl border border-zinc-700 px-6 py-3.5 text-center font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              {isVi ? "Cài đặt API Keys" : "Configure API Keys"}
            </a>
          </div>
        )}

        {orderId && (
          <p className="text-center text-xs text-zinc-600">
            {isVi ? "Mã đơn hàng:" : "Order:"} {orderId}
          </p>
        )}
      </div>
    </div>
  );
}
