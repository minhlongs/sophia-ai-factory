"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/seed/components/ui/button";

export default function VideosError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("dashboard.videos.errors");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div
        role="alert"
        className="rounded border border-destructive/50 bg-destructive/10 p-6 space-y-3"
      >
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm">{t("description")}</p>
        <Button onClick={reset} className="min-h-[44px]">
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
