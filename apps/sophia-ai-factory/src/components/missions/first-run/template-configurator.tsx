/**
 * First-Run Wizard Template Configurator Component
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/template-configurator
 */

// i18n-namespace: dashboard.missions.wizard

import React from 'react';
import { Sparkles, Clock, Coins, ArrowRight } from 'lucide-react';
import type { FirstRunTemplate } from '@/land/missions/first-run-template';

export interface TemplateConfiguratorProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  templates: FirstRunTemplate[];
  selectedTemplate: FirstRunTemplate;
  onSelectTemplate: (tmpl: FirstRunTemplate) => void;
  topic: string;
  onChangeTopic: (val: string) => void;
  costEstimate: { totalUsd: number; totalMcu: number };
  onLaunch: () => void;
  locale: 'vi' | 'en';
}

export function TemplateConfigurator({
  t,
  templates,
  selectedTemplate,
  onSelectTemplate,
  topic,
  onChangeTopic,
  costEstimate,
  onLaunch,
  locale,
}: TemplateConfiguratorProps) {
  const getTemplateText = (
    tmpl: FirstRunTemplate,
    field: 'name' | 'description' | 'badge',
  ): string => {
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
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
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
                {getTemplateText(tmpl, 'badge')}
              </span>
              <h4 className="mt-1 font-semibold text-sm text-foreground">
                {getTemplateText(tmpl, 'name')}
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {getTemplateText(tmpl, 'description')}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-foreground">
          {t('topicLabel')}
        </label>
        <input
          type="text"
          value={topic}
          maxLength={200}
          onChange={(e) => onChangeTopic(e.target.value)}
          placeholder={selectedTemplate.defaultTopic[locale] || t('topicPlaceholder')}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedTemplate.suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChangeTopic(p[locale])}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
            >
              + {p[locale]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3.5 border border-border/60 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Coins className="h-4 w-4 text-primary" />{' '}
            {t('costEstimate', {
              usd: costEstimate.totalUsd,
              mcu: costEstimate.totalMcu,
            })}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" /> {t('durationEstimate')}
          </span>
        </div>
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          ✓ {t('zeroHiddenFees')}
        </span>
      </div>

      <button
        type="button"
        onClick={onLaunch}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-[0.99]"
      >
        <Sparkles className="h-4 w-4" />
        {t('launchButton')}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
