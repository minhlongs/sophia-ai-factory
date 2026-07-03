"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Badge } from "@/seed/components/ui/badge";
import { Copy, Check, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface PaymentMethod {
  id: string;
  key: string;
  label: string;
  recommended?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────

const paymentMethods: PaymentMethod[] = [
  { id: "usdt_trc20", key: "usdt_trc20", label: "USDT TRC-20", recommended: true },
  { id: "usdc_solana", key: "usdc_solana", label: "USDC Solana" },
  { id: "btc", key: "btc", label: "BTC" },
  { id: "nowpayments", key: "nowpayments_invoice", label: "NOWPayments Invoice" },
];

const MOCK_WALLET_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// ─── PaymentMethodCard ────────────────────────────────────────────

function PaymentMethodCard({
  method,
  selected,
  onSelect,
  t,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(method.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        selected
          ? "border-indigo-500 bg-indigo-500/5"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      )}
      aria-pressed={selected}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-indigo-500 bg-indigo-500" : "border-zinc-600"
        )}
        aria-hidden="true"
      >
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      <span className="flex-1 text-sm font-medium text-white">
        {t(method.key) || method.label}
      </span>
      {method.recommended && (
        <Badge
          variant="default"
          className="border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-400"
        >
          {t("recommended")}
        </Badge>
      )}
    </button>
  );
}

// ─── PaymentPanel ──────────────────────────────────────────────────

function PaymentPanel({ t }: { t: (key: string) => string }) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_WALLET_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  };

  const isCrypto = selectedMethod && selectedMethod !== "nowpayments";

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="px-4 pb-0 pt-4">
        <CardTitle className="text-lg font-semibold text-white">
          {t("payment_method")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-4">
        {/* Payment Method Selection */}
        <div className="space-y-2">
          {paymentMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              selected={selectedMethod === method.id}
              onSelect={setSelectedMethod}
              t={t}
            />
          ))}
        </div>

        {/* Wallet Address Panel (shown after crypto selection) */}
        {isCrypto && (
          <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-xs text-zinc-400">{t("guidance_text")}</p>

            {/* Wallet Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                {t("wallet_address")}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                <code className="flex-1 truncate font-mono text-sm text-white">
                  {MOCK_WALLET_ADDRESS}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-8 w-8 shrink-0 text-zinc-400 hover:text-white"
                  aria-label={copied ? t("copied") : t("copy")}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex justify-center">
              <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900">
                <span className="text-xs text-zinc-500">{t("qr_code")}</span>
              </div>
            </div>

            {/* Confirm Button */}
            <Button className="w-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              {t("confirm_payment")}
            </Button>
          </div>
        )}

        {/* NOWPayments fallback */}
        {selectedMethod === "nowpayments" && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-center">
            <p className="text-sm text-zinc-400">{t("nowpayments_redirect")}</p>
            <Button className="mt-4 w-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              {t("proceed_to_invoice")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── OrderSummaryCard ──────────────────────────────────────────────

function OrderSummaryCard({ t }: { t: (key: string) => string }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="px-4 pb-0 pt-4">
        <CardTitle className="text-base font-semibold text-white">
          {t("order_summary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-4">
        {/* Plan Selected */}
        <div className="text-sm font-semibold text-white">
          {t("plan_selected")}
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-normal text-zinc-400">
              {t("subscription")}
            </span>
            <span className="text-sm font-semibold text-white">
              {t("subscription_price")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-normal text-zinc-400">
              {t("ai_credits")}
            </span>
            <span className="text-sm font-semibold text-white">
              {t("ai_credits_price")}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800" />

        {/* Grand Total */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-400">
            {t("grand_total")}
          </span>
          <span className="text-lg font-bold text-indigo-400">
            {t("grand_total_price")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function CheckoutPage() {
  const t = useTranslations("checkout");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
        <ol className="flex items-center gap-1.5">
          <li>
            <span>{t("breadcrumb_billing")}</span>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li>
            <span className="text-white">{t("breadcrumb_checkout")}</span>
          </li>
        </ol>
      </nav>

      {/* Page Heading */}
      <h1 className="text-[28px] font-bold leading-tight text-white">
        {t("page_title")}
      </h1>

      {/* Main Split Layout */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Left: Order Summary */}
        <OrderSummaryCard t={t} />

        {/* Right: Payment Panel */}
        <PaymentPanel t={t} />
      </div>
    </div>
  );
}
