import React from "react";
import dynamic from "next/dynamic";
import { templateService } from "@/land/services/template-service";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { getTranslations } from 'next-intl/server';
import { getUserTier } from "@/seed/db/get-user-tier";
import { getTopPrograms } from "@/land/affiliates";

const CreateProjectFormWithTemplates = dynamic(
  () => import("../components/campaign-creation-form-with-template-selector").then(m => ({ default: m.CreateProjectFormWithTemplates })),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    ),
  }
);

export default async function CreateProjectPage() {
  const t = await getTranslations('campaign.template_selection');
  const user = await getCurrentUser();

  const templates = await templateService.getTemplates(user?.id);
  const tier = user ? await getUserTier(user.id) : 'BASIC';
  const affiliatePrograms = getTopPrograms(5, tier);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <CreateProjectFormWithTemplates templates={templates} affiliatePrograms={affiliatePrograms} />
    </div>
  );
}
