'use client';

import { useTranslations } from 'next-intl';
import { Edit2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import type { TemplatePack } from './types';

interface TemplateEditorProps {
  template: TemplatePack;
  variables: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TemplateEditor({
  template,
  variables,
  onVariableChange,
  onBack,
  onContinue,
}: TemplateEditorProps) {
  const t = useTranslations('setupWizard.whatsappTemplates');
  const common = useTranslations('common');

  const previewText = template.example.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => variables[key] || match
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">{t('editTemplate') || 'Customize Template'}</h2>
          <p className="text-muted-foreground mt-1">
            {t('editTemplateHelp') || 'Fill in the variables below to personalize your template'}
          </p>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
          {template.name}
        </span>
      </div>

      <div className="space-y-4">
        {template.variables.map((variable) => (
          <div key={variable} className="space-y-2">
            <label htmlFor={variable} className="block text-sm font-medium text-foreground">
              {variable.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </label>
            <input
              id={variable}
              type="text"
              value={variables[variable] || ''}
              onChange={(e) => onVariableChange(variable, e.target.value)}
              placeholder={t(`variables.${variable}.placeholder`) || `Enter ${variable.replace(/_/g, ' ')}`}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {t(`variables.${variable}.help`) && (
              <p className="text-xs text-muted-foreground">{t(`variables.${variable}.help`)}</p>
            )}
          </div>
        ))}

        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
            <Edit2 className="w-4 h-4" aria-hidden="true" />
            {t('preview') || 'Preview'}
          </h4>
          <p className="text-sm text-foreground font-mono whitespace-pre-wrap bg-background p-3 rounded border border-border">
            {previewText}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-border">
        <Button variant="outline" onClick={onBack}>
          {common('back') || 'Back'}
        </Button>
        <Button onClick={onContinue}>
          {common('next') || 'Continue'}
        </Button>
      </div>
    </div>
  );
}
