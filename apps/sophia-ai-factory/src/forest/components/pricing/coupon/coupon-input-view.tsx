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
import { CouponCodeForm } from "./coupon-code-form";

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
      <CouponCodeForm
        code={code}
        onCodeChange={setCode}
        onApply={handleApply}
        onClear={handleClear}
        isApplied={isApplied}
        status={status}
        message={message}
        labelText={t("label")}
        placeholderText={tPromo("placeholder")}
        applyText={t("apply")}
        applyingText={t("applying")}
        clearText={t("clear")}
        helpText={tPromo("help_text")}
      />

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
