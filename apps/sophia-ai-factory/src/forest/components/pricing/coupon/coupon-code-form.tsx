'use client';

/**
 * CouponCodeForm — input box, apply/clear buttons & validation status message
 *
 * Layer: forest/components/pricing/coupon
 */

import React from "react";

export interface CouponCodeFormProps {
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  isApplied: boolean;
  status: "idle" | "loading" | "success" | "error";
  message: string;
  labelText: string;
  placeholderText: string;
  applyText: string;
  applyingText: string;
  clearText: string;
  helpText: string;
}

export function CouponCodeForm({
  code,
  onCodeChange,
  onApply,
  onClear,
  isApplied,
  status,
  message,
  labelText,
  placeholderText,
  applyText,
  applyingText,
  clearText,
  helpText,
}: CouponCodeFormProps) {
  return (
    <div className="mx-auto max-w-md mb-10">
      <label
        htmlFor="coupon-code-input"
        className="block text-sm font-medium text-muted-foreground mb-2 text-center"
      >
        {labelText}
      </label>

      <div className="flex gap-2">
        <input
          id="coupon-code-input"
          type="text"
          value={code}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && !isApplied && onApply()}
          placeholder={placeholderText}
          disabled={isApplied || status === "loading"}
          maxLength={32}
          aria-invalid={status === "error" ? true : undefined}
          aria-describedby={message ? "coupon-message" : undefined}
          className="flex-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 uppercase tracking-widest"
        />

        {isApplied ? (
          <button
            onClick={onClear}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            {clearText}
          </button>
        ) : (
          <button
            onClick={onApply}
            disabled={!code.trim() || status === "loading"}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? applyingText : applyText}
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

      <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
        {helpText}
      </p>
    </div>
  );
}
