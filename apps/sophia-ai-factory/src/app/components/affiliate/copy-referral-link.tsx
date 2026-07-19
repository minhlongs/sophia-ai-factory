"use client";

/**
 * Client component: generates + copies the affiliate referral link.
 * Uses the /api/referral/generate endpoint (same as ReferralShareWidget).
 * Used on the public /affiliate landing page.
 */

import { useState } from "react";
import { Copy, Check, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCsrfToken } from "@/seed/security/use-csrf-token";

interface ReferralGenerateResponse {
  code?: string;
  error?: string;
}

export function CopyReferralLink() {
  const t = useTranslations("affiliateProgram");
  const csrfHeaders = useCsrfToken();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/generate", {
        method: "POST",
        headers: { ...csrfHeaders },
      });
      if (res.status === 401) {
        setError(t("copyLink.loginHint"));
        return;
      }
      const data = (await res.json()) as ReferralGenerateResponse;
      if (data.code) {
        setCode(data.code);
      } else {
        setError(data.error ?? "Failed to generate link.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!code) return;
    navigator.clipboard
      .writeText(`https://sophia.agencyos.network/?ref=${code}`)
      .catch(() => {/* fallback: ignore clipboard errors */});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const referralUrl = code ? `sophia.agencyos.network/?ref=${code}` : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4 max-w-lg mx-auto">
      <h3 className="font-semibold text-lg text-foreground">{t("copyLink.title")}</h3>

      {error && (
        <p className="text-sm text-yellow-400">{error}</p>
      )}

      {!referralUrl ? (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-semibold shadow hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Zap className="w-4 h-4" aria-hidden="true" />
          {loading ? t("copyLink.generating") : t("copyLink.cta")}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-3 py-2.5 rounded-lg border border-border font-mono truncate">
            {referralUrl}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
            aria-label={copied ? t("copyLink.copied") : t("copyLink.copy")}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4" aria-hidden="true" />
            )}
            {copied ? t("copyLink.copied") : t("copyLink.copy")}
          </button>
        </div>
      )}
    </div>
  );
}
