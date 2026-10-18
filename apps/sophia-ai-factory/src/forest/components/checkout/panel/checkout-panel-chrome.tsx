"use client";

import React from "react";
import { X, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

interface CheckoutPanelHeaderProps {
  onClose: () => void;
}

export function CheckoutPanelHeader({ onClose }: CheckoutPanelHeaderProps) {
  const t = useTranslations("checkoutPanel");
  return (
    <>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Close dialog"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/30 text-primary shadow-[0_0_15px_rgba(139,92,246,0.15)]">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("secure_title")}</h2>
          <p className="text-xs text-muted-foreground">{t("secure_desc")}</p>
        </div>
      </div>
    </>
  );
}

interface CheckoutPanelFooterProps {
  orderId?: string;
}

export function CheckoutPanelFooter({ orderId }: CheckoutPanelFooterProps) {
  const t = useTranslations("checkoutPanel");
  return (
    <div className="mt-8 border-t border-border pt-4 flex items-center justify-between text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Lock className="h-3 w-3" />
        <span>{t("ssl_secured")}</span>
      </div>
      {orderId && <span>ID: {orderId}</span>}
    </div>
  );
}
