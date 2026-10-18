// i18n-namespace: dashboard.missions.wizard

import React from 'react';
import type { FirstRunTemplate } from '@/land/missions/first-run-template';

export function getFirstRunTemplateText(
  t: (key: string, values?: Record<string, string | number>) => string,
  tmpl: FirstRunTemplate,
  field: 'name' | 'description' | 'badge',
  locale: 'vi' | 'en',
): string {
  try {
    let translated = '';
    if (field === 'name') translated = t(`templates.${tmpl.id}.name`);
    else if (field === 'description') translated = t(`templates.${tmpl.id}.description`);
    else if (field === 'badge') translated = t(`templates.${tmpl.id}.badge`);
    if (translated && !translated.startsWith('templates.')) return translated;
  } catch {
    // Fall back to template model definition
  }
  return tmpl[field][locale] ?? tmpl[field].en ?? tmpl[field].vi;
}

export interface TemplateCardGridProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  templates: FirstRunTemplate[];
  selectedTemplate: FirstRunTemplate;
  onSelectTemplate: (tmpl: FirstRunTemplate) => void;
  locale: 'vi' | 'en';
}

export function TemplateCardGrid({
  t,
  templates,
  selectedTemplate,
  onSelectTemplate,
  locale,
}: TemplateCardGridProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground">
        {t('templateSelectLabel')}
      </label>
      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onSelectTemplate(tmpl)}
            className={`text-left rounded-lg p-3.5 border transition ${
              selectedTemplate.id === tmpl.id
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {getFirstRunTemplateText(t, tmpl, 'badge', locale)}
            </span>
            <h4 className="mt-1 font-semibold text-sm text-foreground">
              {getFirstRunTemplateText(t, tmpl, 'name', locale)}
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {getFirstRunTemplateText(t, tmpl, 'description', locale)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
