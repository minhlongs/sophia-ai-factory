"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Loader2, CheckCircle } from "lucide-react";
import { authClient } from "@/lib/better-auth-client";

interface SignupFormProps {
  /** i18n strings — caller passes from server component or static keys */
  t: {
    name_label: string;
    name_placeholder: string;
    email_label: string;
    email_placeholder: string;
    password_label: string;
    password_placeholder: string;
    confirm_label: string;
    confirm_placeholder: string;
    submit: string;
    submitting: string;
    success_title: string;
    success_message: string;
    error_password_mismatch: string;
    error_password_too_short: string;
    error_email_exists: string;
    error_generic: string;
  };
}

/**
 * Signup form — email + password registration via Better Auth.
 * On success redirects to /setup-wizard for BYOK configuration.
 */
export function SignupForm({ t }: SignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /** Client-side validation — returns error string or null */
  function validate(): string | null {
    if (password.length < 8) return t.error_password_too_short;
    if (password !== confirm) return t.error_password_mismatch;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: "/setup-wizard",
      });

      if (authError) {
        const msg = authError.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("exist") || msg.includes("duplicate")) {
          setError(t.error_email_exists);
        } else {
          setError(authError.message ?? t.error_generic);
        }
        return;
      }

      setSuccess(true);
      // Brief delay so user sees the success message before redirect
      setTimeout(() => {
        router.push("/setup-wizard");
        router.refresh();
      }, 1200);
    } catch {
      setError(t.error_generic);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" data-testid="signup-success">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-green-400" />
        </div>
        <p className="font-semibold text-foreground">{t.success_title}</p>
        <p className="text-sm text-muted-foreground">{t.success_message}</p>
        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="signup-form">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1">
        <label htmlFor="signup-name" className="text-sm font-medium text-foreground">
          {t.name_label}
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.name_placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label htmlFor="signup-email" className="text-sm font-medium text-foreground">
          {t.email_label}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.email_placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1">
        <label htmlFor="signup-password" className="text-sm font-medium text-foreground">
          {t.password_label}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password_placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      {/* Confirm password */}
      <div className="space-y-1">
        <label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">
          {t.confirm_label}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t.confirm_placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {t.submitting}</>
        ) : (
          t.submit
        )}
      </button>
    </form>
  );
}
