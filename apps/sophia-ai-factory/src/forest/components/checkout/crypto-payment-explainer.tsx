"use client";

/**
 * CryptoPaymentExplainer — plain-language guide for non-crypto Vietnamese users.
 * Explains USDT, wallet selection, network choice (TRC20 vs ERC20), timing.
 * Bilingual VI/EN via next-intl `pricing` namespace.
 *
 * Used on the pricing/checkout page above the NOWPayments button.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

interface ExplainerStep {
  titleKey: string;
  descKey: string;
}

const STEPS: ExplainerStep[] = [
  { titleKey: "crypto_what_is_usdt", descKey: "crypto_what_is_usdt_desc" },
  { titleKey: "crypto_wallet_title", descKey: "crypto_wallet_desc" },
  { titleKey: "crypto_network_title", descKey: "crypto_network_desc" },
  { titleKey: "crypto_send_title", descKey: "crypto_send_desc" },
  { titleKey: "crypto_time_title", descKey: "crypto_time_desc" },
];

export function CryptoPaymentExplainer() {
  const t = useTranslations("pricing");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-violet-500/10"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true" />
          <span className="text-sm font-medium text-violet-200">
            {t("crypto_explainer_title")}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true" />
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-violet-500/20 px-4 pb-4 pt-3 space-y-4">
          <p className="text-xs text-violet-300/80">{t("crypto_explainer_subtitle")}</p>

          {/* Step-by-step guide */}
          <ol className="space-y-3">
            {STEPS.map(({ titleKey, descKey }, idx) => (
              <li key={titleKey} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300 mt-0.5">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-violet-200">
                    {/* title keys without numeric prefix — just use the plain step title */}
                    {t(titleKey as Parameters<typeof t>[0])}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {t(descKey as Parameters<typeof t>[0])}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* No crypto wallet fallback */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-300 mb-1">
              {t("crypto_no_wallet_title")}
            </p>
            <p className="text-xs text-amber-200/80 mb-2">
              {t("crypto_no_wallet_desc")}
            </p>
            <a
              href="mailto:support@mekongmind.com?subject=PayOS Payment Request"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              {t("crypto_support_cta")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
