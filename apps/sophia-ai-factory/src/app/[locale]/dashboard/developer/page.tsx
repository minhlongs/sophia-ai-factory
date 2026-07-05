/**
 * Dashboard Developer Page — server gate + tier info provider.
 *
 * Auth-gates via getCurrentUser(), resolves user tier, renders DeveloperClient.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import { getTranslations } from "next-intl/server";
import { tierToRateLimit } from "@/forest/api-keys/d1-store";
import DeveloperClient from "./developer-client";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function DeveloperPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const userTier = await resolveUserTier(user.id);
  const rateLimitPerMin = tierToRateLimit(userTier);
  const t = await getTranslations("dashboard.developer");

  return (
    <DeveloperClient
      userTier={userTier}
      rateLimitPerMin={rateLimitPerMin}
      pageTitle={t("page_title")}
      pageSubtitle={t("page_subtitle")}
      rateLimitsLabel={t("rate_limits")}
      currentLimitLabel={t("current_limit")}
      callsPerMinute={t("calls_per_minute", { limit: rateLimitPerMin })}
      usageLabel={t("usage")}
      noUsageDataLabel={t("no_usage_data")}
      viewApiDocsLabel={t("view_api_docs")}
    />
  );
}
