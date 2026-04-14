import React from "react";
import { getCurrentUser } from "@/lib/better-auth-session";
import { getUserTier } from "@/lib/db/get-user-tier";
import { Tier } from "@/types";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Clock, Crown, Star } from "lucide-react";

export const metadata = {
  title: "Support | Sophia AI",
  description: "Get help and support for your Sophia AI account",
};

const SUPPORT_TIERS = [
  {
    tier: "BASIC" as Tier,
    icon: Mail,
    responseTime: "48h",
    channel: "Email",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  {
    tier: "PREMIUM" as Tier,
    icon: Clock,
    responseTime: "24h",
    channel: "Priority Email",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    tier: "ENTERPRISE" as Tier,
    icon: Star,
    responseTime: "4h",
    channel: "Direct Founder Access",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    tier: "MASTER" as Tier,
    icon: Crown,
    responseTime: "Instant",
    channel: "VIP Forever",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export default async function SupportPage() {
  const t = await getTranslations("dashboard.support");
  const user = await getCurrentUser();

  const userTier: Tier = user ? await getUserTier(user.id) : "BASIC" as Tier;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SUPPORT_TIERS.map((support) => {
          const Icon = support.icon;
          const isCurrentTier = support.tier === userTier;
          return (
            <Card
              key={support.tier}
              className={`border-border ${isCurrentTier ? "ring-2 ring-primary" : ""}`}
            >
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className={`p-2 rounded-lg ${support.bgColor}`}>
                  <Icon className={`w-5 h-5 ${support.color}`} />
                </div>
                <div>
                  <CardTitle className="text-base text-foreground">
                    {support.tier}
                    {isCurrentTier && (
                      <span className="ml-2 text-xs font-normal text-primary">
                        ({t("current_plan")})
                      </span>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("response_time")}
                  </span>
                  <span className="font-medium text-foreground">
                    {support.responseTime}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("channel")}
                  </span>
                  <span className="font-medium text-foreground">
                    {support.channel}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <Mail className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("contact_us")}</p>
            <a
              href="mailto:support@sophia.agencyos.network"
              className="inline-block text-primary hover:underline font-medium"
            >
              support@sophia.agencyos.network
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
