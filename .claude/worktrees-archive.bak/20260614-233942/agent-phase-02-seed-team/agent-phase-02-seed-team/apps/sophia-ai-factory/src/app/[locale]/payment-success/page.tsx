import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Mail, KeyRound, PlayCircle, BarChart3 } from "lucide-react";
import { getOrderById } from "@/land/orders/pending-order-repo";
import { PaymentStatusPoller } from "@/forest/components/checkout/payment-status-poller";
import { TIER_CONFIGS } from "@/seed/config/tiers";
import type { Tier } from "@/seed/types";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Payment Confirmed — Sophia AI Factory",
  description: "Your payment has been received. Your account is being set up.",
};

interface PaymentSuccessPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    order_id?: string;
    via?: string;
    code?: string;
    trial_days?: string;
    period?: string;
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
  const t = await getTranslations("paymentSuccess");

  const orderId = sp.order_id ?? "";

  let dbOrder: {
    tier: string;
    customer_email: string | null;
    status: string;
    period: string;
    promo_code: string | null;
  } | null = null;
  let orderStatus: "pending" | "completed" | "failed" | null = null;

  if (orderId.startsWith("sophia_")) {
    try {
      const order = await getOrderById(orderId);
      if (order) {
        dbOrder = {
          tier: order.tier,
          customer_email: order.customer_email,
          status:
            order.status === "expired"
              ? "failed"
              : (order.status as "pending" | "completed" | "failed"),
          period: order.period,
          promo_code: order.promo_code,
        };
        orderStatus = dbOrder.status as "pending" | "completed" | "failed";
      }
    } catch {
      /* non-fatal */
    }
  }

  if (orderStatus === "failed") {
    redirect(
      `/${locale}/checkout/failure?orderId=${encodeURIComponent(orderId)}`,
    );
  }

  const validTiers = Object.keys(TIER_CONFIGS) as Tier[];
  const tierFromDb = dbOrder?.tier ?? "BASIC";
  const tier = validTiers.includes(tierFromDb as Tier)
    ? (tierFromDb as Tier)
    : "BASIC";
  const rawEmail = dbOrder?.customer_email ?? "";
  const maskedEmail = rawEmail ? maskEmail(rawEmail) : "";
  const viaPromo =
    sp.via === "promo" ||
    (dbOrder?.promo_code !== null && dbOrder?.promo_code !== undefined);
  const promoCode = sp.code ?? dbOrder?.promo_code ?? "";
  const trialDays = sp.trial_days
    ? Math.min(parseInt(sp.trial_days), 365)
    : 0;
  const period =
    dbOrder?.period ??
    sp.period ??
    (tier === "MASTER" ? "lifetime" : "monthly");

  const tierName =
    tier === "BASIC"
      ? t("tier_starter")
      : tier === "PREMIUM"
        ? t("tier_growth")
        : tier === "ENTERPRISE"
          ? t("tier_premium")
          : t("tier_master");

  const steps = [
    { icon: Mail, label: t("step_check_email"), desc: t("step_check_email_desc") },
    { icon: KeyRound, label: t("step_setup_keys"), desc: t("step_setup_keys_desc") },
    { icon: PlayCircle, label: t("step_enable_sop"), desc: t("step_enable_sop_desc") },
    { icon: BarChart3, label: t("step_watch_results"), desc: t("step_watch_results_desc") },
  ];

  const title = viaPromo ? t("title_promo") : t("title_paid");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-muted to-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {orderStatus === "pending" && orderId && (
          <PaymentStatusPoller orderId={orderId} locale={locale} />
        )}

        {(orderStatus === "completed" || !orderStatus) && (
          <div className="rounded-2xl border border-emerald-500/20 bg-muted/[0.03] backdrop-blur-sm p-8 text-center shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                  @keyframes stroke { 100% { stroke-dashoffset: 0; } }
                  @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
                  @keyframes fill { 100% { box-shadow: inset 0 0 0 30px rgba(16, 185, 129, 0.15); } }
                  .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: #34d399; fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
                  .checkmark { width: 56px; height: 56px; border-radius: 50%; display: block; stroke-width: 2; stroke: #34d399; stroke-miterlimit: 10; margin: 10% auto; box-shadow: inset 0 0 0 #34d399; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
                  .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }
                `,
                }}
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                  <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
                  <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-white">{title}</h1>

            {viaPromo && promoCode && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-mono font-semibold text-primary-300">
                {promoCode}
              </div>
            )}

            <p className="mb-1 text-muted-foreground text-sm">
              {t("plan_label")}:{" "}
              <span className="font-semibold text-emerald-400">
                {trialDays > 0 ? t("trial_days", { days: trialDays }) : tierName}
              </span>
            </p>

            {maskedEmail && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3">
                <p className="text-sm text-blue-300">
                  {t("magic_link_sent_to")}{" "}
                  <span className="font-mono font-semibold text-blue-200">{maskedEmail}</span>
                </p>
              </div>
            )}

            {!maskedEmail && (
              <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">{t("check_email_for_magic_link")}</p>
              </div>
            )}
          </div>
        )}

        {(orderStatus === "completed" || !orderStatus) && orderId && (
          <div className="rounded-2xl border border-border/50 bg-muted/10 backdrop-blur-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/10 pb-2 text-left">
              {t("receipt_title")}
            </h2>
            <div className="space-y-2 text-xs md:text-sm text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("order_id_label")}:</span>
                <span className="font-mono text-foreground">{orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("plan_label_rcpt")}:</span>
                <span className="font-medium text-emerald-400">
                  {trialDays > 0 ? t("trial_days", { days: trialDays }) : tierName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("billing_cycle_label")}:</span>
                <span className="text-foreground capitalize">
                  {period === "lifetime" ? t("period_lifetime") : period === "yearly" ? t("period_yearly") : t("period_monthly")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("transaction_status")}:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {t("status_completed")}
                </span>
              </div>
              {sp.via && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("method_label")}:</span>
                  <span className="text-primary-300 font-medium">
                    {sp.via === "promo" ? t("method_promo") : sp.via}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {(orderStatus === "completed" || !orderStatus) && (
          <div className="rounded-2xl border border-border bg-muted/10 backdrop-blur-sm p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider text-left">
              {t("next_steps_title")}
            </h2>
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/15 border border-primary-500/20 mt-0.5">
                    <step.icon className="h-4 w-4 text-primary-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-primary-400 mr-1.5">{i + 1}.</span>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(orderStatus === "completed" || !orderStatus) && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <p className="text-sm text-emerald-300 mb-1">{t("campaign_ready_in")}</p>
            <p className="text-2xl font-bold text-emerald-400 mb-3">5–10 {t("minutes_label")}</p>
            <p className="text-xs text-muted-foreground mb-4">{t("setup_cta")}</p>
            <Link
              href={`/${locale}/setup-wizard`}
              className="inline-block rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150"
            >
              {t("start_setup")}
            </Link>
          </div>
        )}

        {(orderStatus === "completed" || !orderStatus) && (
          <div className="flex flex-col gap-3">
            <Link
              href={`/${locale}/dashboard`}
              className="inline-block w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-center font-semibold text-white transition hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/20"
            >
              {t("go_dashboard")}
            </Link>
            <Link
              href={`/${locale}/dashboard/settings`}
              className="inline-block w-full rounded-xl border border-border px-6 py-3.5 text-center font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              {t("configure_keys")}
            </Link>
          </div>
        )}

        {orderId && (
          <p className="text-center text-xs text-muted-foreground">
            {t("order_label")} {orderId}
          </p>
        )}
      </div>
    </div>
  );
}
