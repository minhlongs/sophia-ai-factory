"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

type AuthMode = "password" | "magic";

/**
 * Login page — D1 + JWT custom auth.
 * Supports password login and magic link (email OTP).
 * Vietnamese UI, dark theme.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, magicLink: true }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Gửi magic link thất bại");
        return;
      }

      setMagicSent(true);
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  if (magicSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Kiểm Tra Email Của Bạn</h2>
            <p className="text-sm text-muted-foreground">
              Chúng tôi đã gửi link đăng nhập đến <strong className="text-foreground">{email}</strong>.
              Link có hiệu lực trong 15 phút.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Không thấy email? Kiểm tra thư mục Spam/Junk hoặc tab Promotions.
            </p>
            <button
              onClick={() => { setMagicSent(false); setMode("password"); }}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Quay lại đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Đăng Nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sophia AI — Nhà Máy Video &amp; AI Tự Động
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => { setMode("password"); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "password"
                  ? "bg-violet-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mật khẩu
            </button>
            <button
              type="button"
              onClick={() => { setMode("magic"); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "magic"
                  ? "bg-violet-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</>
                ) : (
                  "Đăng Nhập"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nhập email để nhận link đăng nhập. Không cần mật khẩu.
                <br />
                <span className="text-violet-400">Chưa có tài khoản? Magic link sẽ tự động tạo cho bạn.</span>
              </p>
              <div className="space-y-1">
                <label htmlFor="email-magic" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email-magic"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
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
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
                ) : (
                  "Gửi Magic Link"
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">Hoặc liên hệ hỗ trợ</span>
            </div>
          </div>

          {/* Fallback contact */}
          <div className="space-y-2">
            <a
              href="https://t.me/Sophia_Bbot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
            >
              Telegram Bot @Sophia_Bbot
            </a>
            <a
              href="mailto:support@agencyos.network"
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Mail className="w-4 h-4" />
              support@agencyos.network
            </a>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
