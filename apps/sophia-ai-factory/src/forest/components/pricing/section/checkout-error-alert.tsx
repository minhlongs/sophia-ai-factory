"use client";

import { useTranslations } from "next-intl";

interface CheckoutErrorAlertProps {
  error: string;
  onDismiss: () => void;
}

export function CheckoutErrorAlert({ error, onDismiss }: CheckoutErrorAlertProps) {
  const t = useTranslations("landing");

  return (
    <div className="mt-6 mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
      <p className="text-sm text-red-400">{error}</p>
      <button
        onClick={onDismiss}
        className="text-xs text-red-300 hover:text-red-200 underline ml-4 whitespace-nowrap"
      >
        {t("pricing.dismiss")}
      </button>
    </div>
  );
}
