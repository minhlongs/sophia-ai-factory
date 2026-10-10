'use client';

/**
 * Free Redemption Modal for Trial / Full Access Promo Codes
 *
 * Layer: forest/components/pricing/coupon
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { FreeModalState } from "./types";

export interface FreeRedemptionModalProps {
  modal: FreeModalState;
  onClose: () => void;
  tLabel: ReturnType<typeof useTranslations<"pricing.coupon">>;
}

export function FreeRedemptionModal({ modal, onClose, tLabel: t }: FreeRedemptionModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      style={{ overscrollBehavior: "contain" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={freeTitleId}
        className="w-full max-w-md rounded-2xl border border-border bg-card backdrop-blur-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleFocusTrap}
      >
        {done ? (
          <div className="text-center space-y-3">
            <div className="text-4xl" aria-hidden="true">🎉</div>
            <h3 id={freeTitleId} className="text-lg font-bold text-foreground">{tError("access_activated_title")}</h3>
            <p className="text-sm text-muted-foreground">{tError("access_activated_desc")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 id={freeTitleId} className="text-base font-bold text-foreground mb-1">
                {t("free_cta")} — <span className="text-emerald-400">{modal.code}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {modal.discountType === "free_trial"
                  ? tError("free_trial_days", { days: modal.discountValue })
                  : tError("free_full_label")}
              </p>
            </div>

            <div>
              <label htmlFor="free-redemption-email" className="block text-xs text-muted-foreground mb-1">{t("free_email_label")}</label>
              <input
                id="free-redemption-email"
                ref={emailRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("free_email_placeholder")}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "free-redemption-error" : undefined}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="free-redemption-name" className="block text-xs text-muted-foreground mb-1">{t("free_name_label")}</label>
              <input
                id="free-redemption-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("free_name_placeholder")}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {error && <p id="free-redemption-error" role="alert" className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-violet-600 py-3 text-sm font-semibold text-foreground hover:from-emerald-500 hover:to-violet-500 disabled:opacity-50 transition"
            >
              {submitting ? t("free_submitting") : t("free_submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
