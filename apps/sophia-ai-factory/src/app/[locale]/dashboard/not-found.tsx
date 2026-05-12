/**
 * Dashboard 404 — translated, links back to /dashboard.
 *
 * Wave 19 Phase 06 (M7): replaces a generic crash on /dashboard/<garbage> with
 * a friendly localized page. Server component (no client-side hooks needed).
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default async function DashboardNotFound() {
  const t = await getTranslations("dashboard.notFound");

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 p-8 text-center">
      <div className="p-3 rounded-full bg-muted">
        <FileQuestion className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t("back")}
      </Link>
    </div>
  );
}
