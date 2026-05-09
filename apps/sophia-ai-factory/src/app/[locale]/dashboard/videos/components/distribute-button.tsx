/**
 * Server-compatible link button for navigating to the distribute page.
 * Rendered in VideoDetailPage only when video.status === 'completed'
 * and NEXT_PUBLIC_DISTRIBUTE_ENABLED === '1'.
 *
 * @module app/[locale]/dashboard/videos/components/distribute-button
 */

"use client";

import { useTranslations } from "next-intl";

interface Props {
  href: string;
}

export function DistributeButton({ href }: Props) {
  const t = useTranslations("dashboard.videos.distribute");
  return (
    <a
      href={href}
      className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 min-h-[44px] inline-flex items-center gap-2"
    >
      <span aria-hidden="true">&#8599;</span>
      {t("cta")}
    </a>
  );
}
