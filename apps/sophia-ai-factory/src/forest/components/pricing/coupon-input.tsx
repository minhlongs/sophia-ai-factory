"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ValidateResult } from "@/land/promo/promo-types";

export interface PromoDiscount {
  code: string;
  discountType: string;
  discountValue: number;
  appliesToTier: string | null;
  description: string | null;
}

interface CouponInputProps {
  /** Called when a discount code (percent_off / fixed_off) is validated */
  onDiscountApplied: (discount: PromoDiscount) => void;
  /** Called when coupon is cleared */
  onDiscountCleared: () => void;
  /** Optional user ID for per-user limit check */
  userId?: string;
}

interface FreeModalState {
  open: boolean;
  code: string;
  discountType: "free_trial" | "free_full";
  discountValue: number;
  appliesToTier: string | null;
}

export function CouponInput({ onDiscountApplied, onDiscountCleared, userId }: CouponInputProps) {
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

      const result: ValidateResult & { error?: string } = await res.json();

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
        // Show free redemption modal
        setFreeModal({ open: true, code: trimmed, discountType, discountValue, appliesToTier: appliesToTier ?? null });
        setStatus("idle");
        setMessage(
          discountType === "free_trial"
            ? t("applied_trial", { code: trimmed, days: discountValue })
            : t("applied_free", { code: trimmed }),
        );
        return;
      }

      // percent_off / fixed_off
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
        <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
          {t("label")}
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && !isApplied && handleApply()}
            placeholder={tPromo("placeholder")}
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

interface FreeRedemptionModalProps {
  modal: FreeModalState;
  onClose: () => void;
  tLabel: ReturnType<typeof useTranslations<"pricing.coupon">>;
}

function FreeRedemptionModal({ modal, onClose, tLabel: t }: FreeRedemptionModalProps) {
  const tError = useTranslations("pricing.error");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const freeTitleId = "free-redemption-modal-title";

  // Escape key to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus trap
  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]:not([tabindex=\"-1\"])")
    ).filter(el => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { emailRef.current?.focus(); return; }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/promo/redeem-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: modal.code,
          email: email.trim(),
          fullName: name.trim() || undefined,
          tier: modal.appliesToTier ?? "BASIC",
        }),
      });

      const data = await res.json() as { error?: string; magicLink?: string; success?: boolean };
      if (!res.ok || data.error) {
        setError(data.error ?? tError("redemption_failed"));
        setSubmitting(false);
        return;
      }

      setDone(true);
      if (data.magicLink) {
        setTimeout(() => { window.location.href = data.magicLink!; }, 2000);
      }
    } catch {
      setError(t("network_error"));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      style={{ overscrollBehavior: "contain" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={freeTitleId}
        className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-zinc-950/95 backdrop-blur-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleFocusTrap}
      >
        {done ? (
          <div className="text-center space-y-3">
            <div className="text-4xl" aria-hidden="true">🎉</div>
            <h3 id={freeTitleId} className="text-lg font-bold text-white">{tError("access_activated_title")}</h3>
            <p className="text-sm text-zinc-400">{tError("access_activated_desc")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 id={freeTitleId} className="text-base font-bold text-white mb-1">
                {t("free_cta")} — <span className="text-emerald-400">{modal.code}</span>
              </h3>
              <p className="text-xs text-zinc-500">
                {modal.discountType === "free_trial"
                  ? tError("free_trial_days", { days: modal.discountValue })
                  : tError("free_full_label")}
              </p>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t("free_email_label")}</label>
              <input
                ref={emailRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("free_email_placeholder")}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t("free_name_label")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("free_name_placeholder")}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-violet-600 py-3 text-sm font-semibold text-white hover:from-emerald-500 hover:to-violet-500 disabled:opacity-50 transition"
            >
              {submitting ? t("free_submitting") : t("free_submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
