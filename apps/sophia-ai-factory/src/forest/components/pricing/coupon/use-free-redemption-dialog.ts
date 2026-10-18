'use client';

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { FreeModalState } from "./types";

export interface UseFreeRedemptionDialogParams {
  modal: FreeModalState;
  onClose: () => void;
  tLabel: ReturnType<typeof useTranslations<"pricing.coupon">>;
}

export function useFreeRedemptionDialog({
  modal,
  onClose,
  tLabel: t,
}: UseFreeRedemptionDialogParams) {
  const tError = useTranslations("pricing.error");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "button, input, [href], [tabindex]:not([tabindex=\"-1\"])"
      )
    ).filter((el) => !el.hasAttribute("disabled"));
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
    if (!email.trim()) {
      emailRef.current?.focus();
      return;
    }
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

      const data = (await res.json()) as {
        error?: string;
        magicLink?: string;
        success?: boolean;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? tError("redemption_failed"));
        setSubmitting(false);
        return;
      }

      setDone(true);
      if (data.magicLink) {
        setTimeout(() => {
          window.location.href = data.magicLink!;
        }, 2000);
      }
    } catch {
      setError(t("network_error"));
      setSubmitting(false);
    }
  };

  return {
    tError,
    email,
    setEmail,
    name,
    setName,
    submitting,
    done,
    error,
    emailRef,
    dialogRef,
    handleFocusTrap,
    handleSubmit,
  };
}
