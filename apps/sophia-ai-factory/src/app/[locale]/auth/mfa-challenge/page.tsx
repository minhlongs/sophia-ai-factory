"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * MFA Challenge page — shown after password login when TOTP is enabled.
 * User must enter a 6-digit TOTP code (or 9-char backup code) to proceed.
 */
export default function MfaChallengePage() {
  const t = useTranslations("auth.mfa_challenge");
  const router = useRouter();

  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({ error: "generic" })) as { error?: string };
      if (data?.error === "invalid_code") {
        setError(t("error_invalid_code"));
      } else if (data?.error === "mfa_not_configured") {
        // MFA not actually configured — let user through
        router.push("/dashboard");
      } else {
        setError(t("error_generic"));
      }
    } catch {
      setError(t("error_generic"));
    } finally {
      setLoading(false);
    }
  }

  const maxLen = useBackup ? 9 : 6;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck aria-hidden="true" className="w-7 h-7 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          {error && (
            <div role="alert" aria-live="polite" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="mfa-code"
                className="text-sm font-medium text-foreground"
              >
                {useBackup ? t("label_backup") : t("label_totp")}
              </label>
              <div className="relative">
                <KeyRound aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="mfa-code"
                  type="text"
                  inputMode={useBackup ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  autoFocus
                  spellCheck={false}
                  required
                  maxLength={maxLen}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={useBackup ? "XXXX-XXXX" : "000000"}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 tracking-widest text-center text-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || code.length < maxLen}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                  {t("verifying")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          </form>

          {/* Toggle backup code */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setUseBackup((v) => !v);
                setCode("");
                setError(null);
              }}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none rounded"
            >
              {useBackup ? t("use_totp") : t("use_backup")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
