/**
 * Developer Dashboard Client Component
 *
 * Combines API key management with rate limit status and links to API docs.
 * Reuses ApiKeyList + create/show modals from the existing raas components.
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Gauge, BookOpen } from "lucide-react";
import Link from "next/link";
import { ApiKeyList } from "@/forest/components/raas/api-key-list";
import { ApiKeyCreateModal, ApiKeyShowModal } from "@/forest/components/raas/api-key-create-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/seed/components/ui/card";

interface DeveloperClientProps {
  userTier: string;
  rateLimitPerMin: number;
  pageTitle: string;
  pageSubtitle: string;
  rateLimitsLabel: string;
  currentLimitLabel: string;
  callsPerMinute: string;
  usageLabel: string;
  noUsageDataLabel: string;
  viewApiDocsLabel: string;
}

export default function DeveloperClient({
  userTier,
  rateLimitPerMin,
  pageTitle,
  pageSubtitle,
  rateLimitsLabel,
  currentLimitLabel,
  callsPerMinute,
  usageLabel,
  noUsageDataLabel,
  viewApiDocsLabel,
}: DeveloperClientProps) {
  const t = useTranslations("dashboard.developer");
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleKeyCreated(key: string) {
    setCreatedKey(key);
    setShowCreate(false);
    setRefreshTrigger((prev) => prev + 1);
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/dashboard/api-docs"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          {viewApiDocsLabel}
        </Link>
      </div>

      {/* Rate Limit Status */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Gauge className="w-5 h-5" aria-hidden="true" />
            {rateLimitsLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{currentLimitLabel}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{callsPerMinute}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tier: <span className="font-medium">{userTier}</span>
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{usageLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{noUsageDataLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys section */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
            {t("api_keys")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyList
            onCreateKey={() => setShowCreate(true)}
            refreshTrigger={refreshTrigger}
          />
        </CardContent>
      </Card>

      {/* Create key modal */}
      {showCreate && (
        <ApiKeyCreateModal
          onCreated={handleKeyCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Show created key modal */}
      {createdKey && (
        <ApiKeyShowModal
          apiKey={createdKey}
          onDone={() => setCreatedKey(null)}
        />
      )}
    </div>
  );
}
