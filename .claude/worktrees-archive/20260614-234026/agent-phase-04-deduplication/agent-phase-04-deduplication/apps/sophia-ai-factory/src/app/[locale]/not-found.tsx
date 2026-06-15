import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/seed/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("notFoundPage");
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6 text-center space-y-8">
      <div className="relative">
        <h1 className="text-6xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] motion-safe:animate-pulse">
          404
        </h1>
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none opacity-50 blur-xl">
          <span className="text-6xl sm:text-9xl font-black text-[var(--neon-pink)]">
            404
          </span>
        </div>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <h2 className="text-3xl font-bold text-white">{t("heading")}</h2>
        <p className="text-muted-foreground text-lg">{t("description")}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
        <Link href="/">
          <Button
            size="lg"
            className="w-full sm:w-auto gap-2 bg-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/80"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            {t("returnHome")}
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto gap-2 border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t("goToDashboard")}
          </Button>
        </Link>
      </div>

      <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground w-full max-w-2xl border-t border-border mt-8">
        <Link href="/#features" className="hover:text-[var(--neon-cyan)]">
          {t("features")}
        </Link>
        <Link href="/pricing" className="hover:text-[var(--neon-cyan)]">
          {t("pricing")}
        </Link>
        <Link href="/dashboard" className="hover:text-[var(--neon-cyan)]">
          {t("dashboard")}
        </Link>
        <a href="mailto:support@mekongmind.com" className="hover:text-[var(--neon-cyan)]">
          {t("contactSupport")}
        </a>
      </div>
    </div>
  );
}
