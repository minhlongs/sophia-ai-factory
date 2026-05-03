'use client';

/**
 * InstallationEditTab — config form (default) + advanced Markdown override.
 *
 * - If template has config_schema: show no-code form fields first.
 * - "Advanced" collapsible (default closed) contains raw Markdown editor.
 * - Saving config values and playbook overrides are independent actions.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SopConfigForm, parseConfigSchema } from './sop-config-form';
import { PlaybookMarkdownEditor } from './playbook-markdown-editor';
import { Button } from '@/seed/components/ui/button';

interface Props {
  playbookMd: string;
  configSchema: string | null;
  configDefaults: string | null;
  configValues: string | null;  // JSON string from installation
  onSave: (value: string) => Promise<{ error?: string }>;
  onSaveConfig: (values: Record<string, unknown>) => Promise<{ error?: string }>;
}

export function InstallationEditTab({
  playbookMd,
  configSchema,
  configDefaults,
  configValues,
  onSave,
  onSaveConfig,
}: Props) {
  const t = useTranslations('sop');
  const ti = useTranslations('sop.install');

  const { schema, defaults } = parseConfigSchema(configSchema, configDefaults);

  // Merge saved values over defaults
  const savedValues: Record<string, unknown> = (() => {
    try {
      return configValues ? (JSON.parse(configValues) as Record<string, unknown>) : {};
    } catch { return {}; }
  })();

  const [formValues, setFormValues] = useState<Record<string, unknown>>({ ...defaults, ...savedValues });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSaveConfig() {
    setSaveError(null);
    setSaveOk(false);
    startTransition(async () => {
      const result = await onSaveConfig(formValues);
      if (result.error) {
        setSaveError(result.error);
      } else {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      }
    });
  }

  const hasConfigSchema = schema !== null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('edit.title')}</h2>
      </div>

      {/* Config form — primary section */}
      {hasConfigSchema && schema && (
        <div className="space-y-4 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {ti('configureTitle')}
          </h3>
          <SopConfigForm schema={schema} values={formValues} onChange={setFormValues} />

          {saveError && (
            <p className="text-sm text-red-400">{saveError}</p>
          )}
          {saveOk && (
            <p className="text-sm text-emerald-400">{ti('success')}</p>
          )}

          <Button
            size="sm"
            className="bg-violet-700 hover:bg-violet-600"
            onClick={handleSaveConfig}
            disabled={isPending}
          >
            {isPending ? ti('submitting') : ti('submit')}
          </Button>
        </div>
      )}

      {/* Advanced — collapsible Markdown editor */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-card"
        >
          <span>{ti('advancedLabel')}</span>
          {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {advancedOpen && (
          <div className="p-5 space-y-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{ti('advancedHelp')}</p>
            <PlaybookMarkdownEditor initialValue={playbookMd} onSave={onSave} />
          </div>
        )}
      </div>
    </div>
  );
}
