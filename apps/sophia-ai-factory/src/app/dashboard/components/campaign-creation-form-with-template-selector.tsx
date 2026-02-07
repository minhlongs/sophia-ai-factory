"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { CampaignTemplate, applyTemplateDefaults } from "@/lib/templates/campaign-templates";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { Tier } from "@/types";
import { TypewriterEffect } from "@/components/ui/typewriter-effect-animation";

interface CreateProjectFormProps {
  templates: CampaignTemplate[];
}

export function CreateProjectFormWithTemplates({ templates }: CreateProjectFormProps) {
  const router = useRouter();
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

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
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
        setError(result.message || "Something went wrong");
        if ('requiresUpgrade' in result && result.requiresUpgrade) {
          setUpgradeRequired({ required: true, tier: ('requiredTier' in result ? result.requiredTier : "BASIC") as Tier });
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Template Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Choose a Template</h3>
          <p className="text-sm text-gray-500">Start with a pre-configured template or create from scratch</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template)}
              className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                selectedTemplate?.id === template.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {selectedTemplate?.id === template.id && (
                <div className="absolute top-2 right-2">
                  <Check className="w-5 h-5 text-blue-600" />
                </div>
              )}

              <div className="text-3xl mb-2">{template.icon}</div>
              <h4 className="font-semibold text-gray-900 mb-1">{template.name}</h4>
              <p className="text-xs text-gray-600">{template.description}</p>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">{template.defaults.tone}</span>
                  <span>{template.defaults.suggestedDuration}s</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Customization Form (shown after template selection) */}
      {selectedTemplate && (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customize Your Campaign</h3>
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Campaign Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={selectedTemplate.defaults.title}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700">
              Video Topic
            </label>
            <input
              id="topic"
              name="topic"
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder={selectedTemplate.defaults.title}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500">What should this video be about?</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="audience" className="block text-sm font-medium text-gray-700">
              Target Audience
            </label>
            <input
              id="audience"
              name="audience"
              type="text"
              required
              value={formData.audience}
              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              placeholder={selectedTemplate.defaults.audience}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500">Who is this video for?</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Target Platforms
            </label>
            <div className="flex gap-4">
              {['youtube', 'tiktok', 'instagram'].map((platform) => (
                <label key={platform} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={() => handlePlatformToggle(platform)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Select platforms to publish to. Multiple platforms require Premium plan.
            </p>
          </div>

          {/* Template Info Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Template Settings</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Tone:</span>
                <span className="ml-2 font-medium text-gray-900">{selectedTemplate.defaults.tone}</span>
              </div>
              <div>
                <span className="text-gray-500">Duration:</span>
                <span className="ml-2 font-medium text-gray-900">{selectedTemplate.defaults.suggestedDuration}s</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {error}
              </div>

              {upgradeRequired.required && (
                <UpgradeBanner
                  currentTier="BASIC" // Default assumption, or pass via props
                  requiredTier={upgradeRequired.tier}
                  featureName="this feature"
                />
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedTemplate(null)}
            >
              Change Template
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="min-w-[150px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Campaign
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
