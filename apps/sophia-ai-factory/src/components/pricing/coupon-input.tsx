"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface CouponResult {
  success: boolean;
  discountPercent: number;
  originalPrice: number;
  finalPrice: number;
  checkoutUrl?: string;
}

interface TierDiscount {
  tier: string;
  discountPercent: number;
  originalPrice: number;
  finalPrice: number;
  checkoutUrl: string | null;
}

interface CouponInputProps {
  /** Tiers to validate against — e.g. ["BASIC","PREMIUM","MASTER"] */
  tiers: string[];
  /** Called when discounts are successfully applied */
  onDiscountApplied: (discounts: TierDiscount[]) => void;
  /** Called when coupon is cleared */
  onDiscountCleared: () => void;
}

export function CouponInput({ tiers, onDiscountApplied, onDiscountCleared }: CouponInputProps) {
  const t = useTranslations("pricing.coupon");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("");

    try {
      // Call the coupon API for each tier in parallel
      const results = await Promise.allSettled(
        tiers.map((tier) =>
          fetch("/api/coupons/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: trimmed, tier, project: "sophia" }),
          }).then((res) => res.json() as Promise<CouponResult & { error?: string }>)
        )
      );

      // At least one tier must succeed for the coupon to be considered valid
      const discounts: TierDiscount[] = [];
      let anySuccess = false;
      let errorMsg = "";

      results.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value.success) {
          anySuccess = true;
          discounts.push({
            tier: tiers[idx],
            discountPercent: result.value.discountPercent,
            originalPrice: result.value.originalPrice,
            finalPrice: result.value.finalPrice,
            checkoutUrl: result.value.checkoutUrl ?? null,
          });
        } else if (result.status === "fulfilled" && result.value.error) {
          errorMsg = result.value.error;
        }
      });

      if (anySuccess) {
        setStatus("success");
        setAppliedCode(trimmed);
        const pct = discounts[0]?.discountPercent ?? 0;
        setMessage(t("applied", { code: trimmed, pct }));
        onDiscountApplied(discounts);
      } else {
        setStatus("error");
        setMessage(errorMsg || t("invalid"));
      }
    } catch {
      setStatus("error");
      setMessage(t("network_error"));
    }
  };

  const handleClear = () => {
    setCode("");
    setAppliedCode("");
    setStatus("idle");
    setMessage("");
    onDiscountCleared();
  };

  const isApplied = status === "success" && appliedCode;

  return (
    <div className="mx-auto max-w-md mb-10">
      <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
        {t("label")}
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && !isApplied && handleApply()}
          placeholder={t("placeholder")}
          disabled={isApplied || status === "loading"}
          maxLength={32}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 uppercase tracking-widest"
        />

        {isApplied ? (
          <button
            onClick={handleClear}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
          >
            {t("clear")}
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={!code.trim() || status === "loading"}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? t("applying") : t("apply")}
          </button>
        )}
      </div>

      {message && (
        <p
          className={`mt-2 text-center text-xs font-medium ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
