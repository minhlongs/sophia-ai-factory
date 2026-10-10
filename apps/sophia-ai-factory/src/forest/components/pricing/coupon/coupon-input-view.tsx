'use client';

/**
 * CouponInputView — input field, submission handler & status display
 *
 * Layer: forest/components/pricing/coupon
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import type { CouponInputProps, FreeModalState, PromoValidateResponse } from "./types";
import { FreeRedemptionModal } from "./free-redemption-modal";

export function CouponInputView({ onDiscountApplied, onDiscountCleared, userId }: CouponInputProps) {
  const t = useTranslations("pricing.coupon");
  const tPromo = useTranslations("pricing.promo");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [freeModal, setFreeModal] = useState<FreeModalState>({
    open: false,
    code: "",
    discountType: "free_trial",
    discountValue: 0,
    appliesToTier: null,
  });

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, userId }),
      });

      const result: PromoValidateResponse = await res.json();

      if (!result.valid) {
        const reasonKey = (result as { valid: false; reason: string }).reason;
        const msgMap: Record<string, string> = {
          not_found: t("invalid"),
          expired: t("invalid"),
          max_uses: t("max_uses"),
          wrong_tier: t("wrong_tier"),
          wrong_sku: t("wrong_tier"),
          user_limit: t("user_limit"),
          not_started: t("invalid"),
        };
        setStatus("error");
        setMessage(msgMap[reasonKey] ?? t("invalid"));
        return;
      }

      const { discountType, discountValue, appliesToTier, description } = result;

      if (discountType === "free_trial" || discountType === "free_full") {
        setFreeModal({ open: true, code: trimmed, discountType, discountValue, appliesToTier: appliesToTier ?? null });
        setStatus("idle");
        setMessage(
          discountType === "free_trial"
            ? t("applied_trial", { code: trimmed, days: discountValue })
            : t("applied_free", { code: trimmed }),
        );
        return;
      }

      setStatus("success");
      setAppliedCode(trimmed);
      setMessage(t("applied", { code: trimmed, pct: discountType === "percent_off" ? discountValue : 0 }));
      onDiscountApplied({ code: trimmed, discountType, discountValue, appliesToTier: appliesToTier ?? null, description: description ?? null });
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

  const isApplied = status === "success" && !!appliedCode;

  return (
    <>
      <div className="mx-auto max-w-md mb-10">
        <label htmlFor="coupon-code-input" className="block text-sm font-medium text-muted-foreground mb-2 text-center">
          {t("label")}
        </label>

        <div className="flex gap-2">
          <input
            id="coupon-code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && !isApplied && handleApply()}
            placeholder={tPromo("placeholder")}
            disabled={isApplied || status === "loading"}
            maxLength={32}
            aria-invalid={status === "error" ? true : undefined}
            aria-describedby={message ? "coupon-message" : undefined}
            className="flex-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 uppercase tracking-widest"
          />

          {isApplied ? (
            <button
              onClick={handleClear}
              className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {t("clear")}
            </button>
          ) : (
            <button
              onClick={handleApply}
              disabled={!code.trim() || status === "loading"}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading" ? t("applying") : t("apply")}
            </button>
          )}
        </div>

        {message && (
          <p
            id="coupon-message"
            role={status === "error" ? "alert" : "status"}
            className={`mt-2 text-center text-xs font-medium ${
              status === "error" ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {message}
          </p>
        )}

        {/* Help text — surfaces FREE100 partner guidance for non-tech users */}
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          {tPromo("help_text")}
        </p>
      </div>

      {freeModal.open && (
        <FreeRedemptionModal
          modal={freeModal}
          onClose={() => setFreeModal((p) => ({ ...p, open: false }))}
          tLabel={t}
        />
      )}
    </>
  );
}
