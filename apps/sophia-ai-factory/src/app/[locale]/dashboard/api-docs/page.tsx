import React from "react";
import { getCurrentUser } from "@/lib/better-auth-session";
import { getUserTier } from "@/lib/db/get-user-tier";
import { Tier } from "@/types";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Key, Lock } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "API Documentation | Sophia AI",
  description: "API reference and documentation for Sophia AI integrations",
};

const API_ENDPOINTS = [
  { method: "GET", path: "/api/health", description: "Health check" },
  { method: "POST", path: "/api/webhooks/nowpayments", description: "NOWPayments IPN webhook" },
  { method: "POST", path: "/api/webhooks/telegram", description: "Telegram bot webhook" },
  { method: "POST", path: "/api/inngest", description: "Inngest function runner" },
  { method: "POST", path: "/api/admin/invite", description: "Invite new user (admin)" },
];

export default async function ApiDocsPage() {
  const t = await getTranslations("dashboard.api_docs");
  const user = await getCurrentUser();

  const userTier: Tier = user ? await getUserTier(user.id) : "BASIC" as Tier;

  const hasAccess = userTier === "ENTERPRISE" || userTier === "MASTER";

  if (!hasAccess) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="text-center space-y-4 py-8">
              <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                {t("upgrade_required")}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t("upgrade_message")}
              </p>
              <Link
                href="/pricing"
                className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                {t("view_plans")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Key className="w-5 h-5" />
            {t("api_key")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm text-muted-foreground font-mono">
              sk-sophia-••••••••••••••••
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("api_key_hint")}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Code className="w-5 h-5" />
            {t("endpoints")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {API_ENDPOINTS.map((endpoint) => (
              <div
                key={endpoint.path}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <span
                  className={`px-2 py-1 text-xs font-mono font-bold rounded ${
                    endpoint.method === "GET"
                      ? "bg-green-500/20 text-green-600"
                      : "bg-blue-500/20 text-blue-600"
                  }`}
                >
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-foreground">
                  {endpoint.path}
                </code>
                <span className="text-sm text-muted-foreground ml-auto">
                  {endpoint.description}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
