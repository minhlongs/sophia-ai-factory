"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/app/actions/campaigns";
import { CampaignTemplate, applyTemplateDefaults } from "@/lib/templates/campaign-templates";
import { Tier } from "@/types";
import { TemplateSelector } from "./create-campaign/template-selector";
import { CampaignForm } from "./create-campaign/campaign-form";
import { useTranslations } from 'next-intl';

interface CreateProjectFormProps {
  templates: CampaignTemplate[];
}

export function CreateProjectFormWithTemplates({ templates }: CreateProjectFormProps) {
  const router = useRouter();
  const t = useTranslations('campaign.errors');
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState<{ required: boolean; tier: Tier }>({ required: false, tier: "BASIC" });

  // Pre-fill form with template defaults when template selected
  const [formData, setFormData] = useState({
    topic: "",
    audience: "",
    title: ""
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube"]);

  const handleTemplateSelect = (template: CampaignTemplate) => {
    setSelectedTemplate(template);
    const defaults = applyTemplateDefaults(template);
    setFormData({
      topic: defaults.title,
      audience: defaults.audience,
      title: defaults.title
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUpgradeRequired({ required: false, tier: "BASIC" });

    const formDataObj = new FormData(e.currentTarget);

    // Add template_id if template selected
    if (selectedTemplate) {
      formDataObj.append("template_id", selectedTemplate.id);
    }

    // Add selected platforms
    selectedPlatforms.forEach(p => formDataObj.append("platforms", p));

    try {
      const result = await createCampaign(formDataObj);

      if (result.success) {
        router.push("/dashboard/campaigns");
        router.refresh();
      } else {
        setError(result.message || t('something_wrong'));
        if ('requiresUpgrade' in result && result.requiresUpgrade) {
          setUpgradeRequired({ required: true, tier: ('requiredTier' in result ? result.requiredTier : "BASIC") as Tier });
        }
      }
    } catch (err) {
      console.error(err);
      setError(t('create_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Template Selection */}
      <TemplateSelector
        templates={templates}
        selectedTemplateId={selectedTemplate?.id || null}
        onSelect={handleTemplateSelect}
      />

      {/* Customization Form (shown after template selection) */}
      {selectedTemplate && (
        <CampaignForm
          selectedTemplate={selectedTemplate}
          formData={formData}
          setFormData={setFormData}
          selectedPlatforms={selectedPlatforms}
          setSelectedPlatforms={setSelectedPlatforms}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          upgradeRequired={upgradeRequired}
          onChangeTemplate={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}
