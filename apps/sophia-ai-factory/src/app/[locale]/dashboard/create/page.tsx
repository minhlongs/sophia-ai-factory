import React from "react";
import { CreateProjectFormWithTemplates } from "../components/campaign-creation-form-with-template-selector";
import { templateService } from "@/lib/services/template-service";
import { createServerClient } from "@/lib/supabase/server";
import { getTranslations } from 'next-intl/server';

export default async function CreateProjectPage() {
  const t = await getTranslations('campaign.template_selection');
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  const templates = await templateService.getTemplates(session?.user?.id);

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
