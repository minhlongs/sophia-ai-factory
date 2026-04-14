import React from "react";
import dynamic from "next/dynamic";
import { templateService } from "@/lib/services/template-service";
import { getCurrentUser } from "@/lib/db/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from 'next-intl/server';
import { cookies } from "next/headers";

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
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const user = await getCurrentUser(cookieHeader);

  const templates = await templateService.getTemplates(user?.id);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <CreateProjectFormWithTemplates templates={templates} />
    </div>
  );
}
