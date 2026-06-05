import React from "react";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { TierGateCard } from "@/seed/components/ui/tier-gate-card";
import { logger } from "@/seed/utils/logger-utility";
import { toError } from "@/seed/utils/to-error";
import type { Tier } from "@/seed/types";

// ── Dynamic import ────────────────────────────────────────────────────────────

function OutcomesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[380px] rounded-xl" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

import { OutcomesDashboardClient } from "./components/outcomes-dashboard-client";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata = {
  title: "AGI Outcomes | Sophia AI",
  description: "SOP execution outcomes — views, CTR, revenue, engagement",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgiOutcomesPage() {
  const t = await getTranslations("dashboard.agiOutcomes");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let userTier: Tier = "BASIC";
  try {
    userTier = await resolveUserTier(user.id);
  } catch (err) {
    logger.error("[AgiOutcomes] Failed to load tier", toError(err));
  }

  const hasPremiumAccess = userTier !== "BASIC";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {hasPremiumAccess ? (
        <OutcomesDashboardClient userId={user.id} tier={userTier} />
      ) : (
        <TierGateCard
          requiredTier="PREMIUM"
          currentTier={userTier}
          featureName={t("title")}
        >
          {null}
        </TierGateCard>
      )}
    </div>
  );
}
