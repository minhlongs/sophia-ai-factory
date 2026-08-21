import type { Metadata } from "next";
import { CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PaymentStatusPoller } from "@/forest/components/checkout/payment-status-poller";

export const metadata: Metadata = {
  title: "Payment Successful — Sophia AI Factory",
  description: "Your payment is being confirmed. Thank you for your order.",
};

interface PaymentSuccessPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tier?: string; order_id?: string }>;
}

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: PaymentSuccessPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const orderId = sp.order_id ?? "";
  const tier = sp.tier ?? "";

  const t = await getTranslations("checkout");
  const hasOrder = Boolean(orderId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center shadow-lg">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {t("success_title")}
          </h1>

          <p className="text-muted-foreground text-sm">
            {tier ? t("success_tier", { tier }) : t("success_desc")}
          </p>
        </div>

        {hasOrder ? (
          <PaymentStatusPoller orderId={orderId} locale={locale} />
        ) : (
          <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("success_no_order")}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <a
            href={`/${locale}/dashboard`}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-center font-semibold text-primary-foreground transition hover:from-primary/90 hover:to-accent/90"
          >
            {t("go_to_dashboard")}
          </a>
          <a
            href="mailto:support@mekongmind.com"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border px-6 py-3.5 text-center font-medium text-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {t("contact_support")}
          </a>
        </div>

        {orderId && (
          <p className="text-center text-xs text-muted-foreground/60">
            {t("order_id_label")} {orderId}
          </p>
        )}
      </div>
    </div>
  );
}