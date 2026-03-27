"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

/**
 * Login page — hiện tại đang chuyển đổi sang Cloudflare D1 + Custom JWT.
 * Supabase auth disabled. Hiển thị thông báo liên hệ.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Đăng Nhập
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sophia AI — Nhà Máy Video & AI Tự Động
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Mail className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Liên Hệ Để Truy Cập</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Hệ thống đăng nhập đang được nâng cấp lên nền tảng Cloudflare.
                Vui lòng liên hệ để được cấp quyền truy cập Dashboard.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="https://t.me/Sophia_Bbot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Liên hệ qua Telegram Bot
            </a>
            <a
              href="mailto:support@agencyos.network"
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
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
