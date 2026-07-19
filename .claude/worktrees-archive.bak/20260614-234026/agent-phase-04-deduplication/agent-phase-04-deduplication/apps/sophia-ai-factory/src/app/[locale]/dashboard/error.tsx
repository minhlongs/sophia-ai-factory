"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw, LogIn, Wifi, Server } from "lucide-react";
import { localizedHref } from "@/land/i18n/localized-href";

type ErrorKind = "auth" | "network" | "db" | "unknown";

function classifyError(error: Error): { icon: typeof AlertTriangle; kind: ErrorKind; action: "retry" | "login" } {
  const msg = (error.message || "").toLowerCase();

  if (msg.includes("unauthorized") || msg.includes("auth")) {
    return { icon: LogIn, kind: "auth", action: "login" };
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout")) {
    return { icon: Wifi, kind: "network", action: "retry" };
  }
  if (msg.includes("d1") || msg.includes("database")) {
    return { icon: Server, kind: "db", action: "retry" };
  }
  return { icon: AlertTriangle, kind: "unknown", action: "retry" };
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("dashboard.errors");
  const locale = useLocale();
  const classified = classifyError(error);
  const Icon = classified.icon;

  useEffect(() => {
    try {
      Sentry.captureException(error, {
        tags: { digest: error.digest ?? "unknown", kind: classified.kind },
      });
    } catch {
      // never let Sentry init failure cascade into a render crash
    }
  }, [error, classified.kind]);

  const titleKey = classified.kind === "auth" ? "authExpired"
    : classified.kind === "network" ? "network"
    : classified.kind === "db" ? "db"
    : "unknown";

  const descKey = classified.kind === "auth" ? "authExpiredDesc"
    : classified.kind === "network" ? "networkDesc"
    : classified.kind === "db" ? "dbDesc"
    : "unknownDesc";

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-[50vh] gap-5">
      <div className="p-3 rounded-full bg-destructive/10">
        <Icon className="w-8 h-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{t(titleKey)}</h2>
        <p className="text-sm text-muted-foreground">{t(descKey)}</p>
      </div>
      <div className="flex gap-3">
        {classified.action === "login" ? (
          <button
            onClick={() => { window.location.href = localizedHref(locale, "/login"); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {t("goLogin")}
          </button>
        ) : (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t("retry")}
          </button>
        )}
      </div>
    </div>
  );
}
