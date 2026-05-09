"use client";

/**
 * Reset Password page.
 *
 * Two modes determined by ?token= query param:
 * - No token  → email request form (calls /api/auth/reset-password/request)
 * - Has token → new password form (calls /api/auth/reset-password/confirm)
 */

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return token ? (
    <ConfirmForm token={token} t={t} router={router} />
  ) : (
    <RequestForm t={t} />
  );
}

// ── Request form ──────────────────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations>;

function RequestForm({ t }: { t: TFn }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError(t("error_generic"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("error_generic"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <PageWrapper>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-green-400" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("success_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("success_body")}</p>
          <p className="text-xs text-muted-foreground/70">{t("spam_note")}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t("back_to_login")}
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("request_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("request_subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
        {error && (
          <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="rp-email" className="text-sm font-medium text-foreground">
              {t("email_label")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                id="rp-email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email_placeholder")}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("submitting")}</>
            ) : (
              t("submit_request")
            )}
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t("back_to_login")}
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}

// ── Confirm form ──────────────────────────────────────────────────────────────

function ConfirmForm({
  token,
  t,
  router,
}: {
  token: string;
  t: TFn;
  router: ReturnType<typeof useRouter>;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t("error_password_too_short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("error_password_mismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };

      if (!data.ok) {
        if (data.error?.includes("expired") || data.error?.includes("Invalid")) {
          setError(t("error_token_expired"));
        } else {
          setError(data.error ?? t("error_generic"));
        }
        return;
      }
      setDone(true);
    } catch {
      setError(t("error_generic"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <PageWrapper>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-green-400" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("confirm_success_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("confirm_success_body")}</p>
          <button
            onClick={() => router.push("/login")}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            {t("sign_in_now")}
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("confirm_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("confirm_subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
        {error && (
          <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {error}
            {error === t("error_token_expired") && (
              <Link href="/reset-password" className="ml-1 underline text-violet-400 hover:text-violet-300">
                {t("request_new_link")}
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="rp-new" className="text-sm font-medium text-foreground">
              {t("new_password_label")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                id="rp-new"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("new_password_placeholder")}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="rp-confirm" className="text-sm font-medium text-foreground">
              {t("confirm_password_label")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                id="rp-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("confirm_password_placeholder")}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("setting")}</>
            ) : (
              t("submit_confirm")
            )}
          </button>
        </form>
      </div>
    </PageWrapper>
  );
}

// ── Shared wrapper ────────────────────────────────────────────────────────────

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md space-y-8">{children}</div>
    </div>
  );
}
