import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/seed/components/ui/card";
import Link from "next/link";
import {
  Brain,
  TrendingUp,
  Shield,
  Bot,
  Key,
  RotateCcw,
  FileCheck,
} from "lucide-react";

export default async function AgiHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  const t = await getTranslations("agi");

  const cards = [
    {
      href: "/dashboard/agi/outcomes",
      icon: <TrendingUp className="w-6 h-6 text-emerald-400" aria-hidden="true" />,
      title: t("outcomes_title"),
      description: t("outcomes_description"),
      comingSoon: false,
    },
    {
      href: "/dashboard/agi/confidence",
      icon: <Shield className="w-6 h-6 text-primary" aria-hidden="true" />,
      title: t("confidence_title"),
      description: t("confidence_description"),
      comingSoon: false,
    },
    {
      href: "/dashboard/agi/agents",
      icon: <Bot className="w-6 h-6 text-primary-400" aria-hidden="true" />,
      title: t("agents_title"),
      description: t("agents_description"),
      comingSoon: false,
    },
    {
      href: "/dashboard/api-keys",
      icon: <Key className="w-6 h-6 text-yellow-400" aria-hidden="true" />,
      title: t("api_keys_title"),
      description: t("api_keys_description"),
      comingSoon: false,
    },
    {
      href: "#",
      icon: <RotateCcw className="w-6 h-6 text-orange-400" aria-hidden="true" />,
      title: t("feedback_title"),
      description: t("feedback_description"),
      comingSoon: true,
    },
    {
      href: "#",
      icon: <FileCheck className="w-6 h-6 text-pink-400" aria-hidden="true" />,
      title: t("compliance_title"),
      description: t("compliance_description"),
      comingSoon: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Brain className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          {t("hub_title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("hub_subtitle")}</p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.comingSoon ? "#" : card.href}
            aria-disabled={card.comingSoon}
            tabIndex={card.comingSoon ? -1 : undefined}
            className={card.comingSoon ? "pointer-events-none" : "group"}
          >
            <Card className="h-full transition-all duration-200 group-hover:border-emerald-500/40 group-hover:bg-emerald-950/10 group-hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {card.icon}
                  {card.comingSoon && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground ring-1 ring-border uppercase tracking-wider">
                      {t("coming_soon")}
                    </span>
                  )}
                </div>
                <CardTitle className="text-base mt-3">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
