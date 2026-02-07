import { CampaignTemplate } from "@/lib/templates/campaign-templates";
import { Check } from "lucide-react";
import { useTranslations } from 'next-intl';

interface TemplateSelectorProps {
  templates: CampaignTemplate[];
  selectedTemplateId: string | null;
  onSelect: (template: CampaignTemplate) => void;
}

export function TemplateSelector({ templates, selectedTemplateId, onSelect }: TemplateSelectorProps) {
  const t = useTranslations('campaign.template_selection');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
              selectedTemplateId === template.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700"
                : "border-border hover:border-primary/50"
            }`}
          >
            {selectedTemplateId === template.id && (
              <div className="absolute top-2 right-2">
                <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            )}

            <div className="text-3xl mb-2">{template.icon}</div>
            <h4 className="font-semibold text-foreground mb-1">{template.name}</h4>
            <p className="text-xs text-muted-foreground">{template.description}</p>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded">{template.defaults.tone}</span>
                <span>{template.defaults.suggestedDuration}s</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
