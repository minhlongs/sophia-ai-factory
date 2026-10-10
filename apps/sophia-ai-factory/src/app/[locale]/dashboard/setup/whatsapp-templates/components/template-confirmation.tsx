'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import type { TemplatePack } from './types';

interface TemplateConfirmationProps {
  template: TemplatePack;
  variables: Record<string, string>;
  isSubmitting: boolean;
  success: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onFinish: () => void;
}

export function TemplateConfirmation({
  template,
  variables,
  isSubmitting,
  success,
  onBack,
  onSubmit,
  onFinish,
}: TemplateConfirmationProps) {
  const t = useTranslations('setupWizard.whatsappTemplates');
  const common = useTranslations('common');

  const filledCount = Object.values(variables).filter(Boolean).length;

  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {t('confirmTitle') || 'Ready to Save'}
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {t('confirmMessage') || 'Your customized template will be saved and ready to use in WhatsApp campaigns.'}
      </p>

      <div className="max-w-md mx-auto text-left mb-6 p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-3">{t('summary') || 'Summary'}</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('template') || 'Template'}</dt>
            <dd className="font-medium">{template.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('category') || 'Category'}</dt>
            <dd className="font-medium capitalize">{template.category}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('variablesFilled') || 'Variables Filled'}</dt>
            <dd className="font-medium">
              {filledCount} / {template.variables.length}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={onBack}>
          {common('back') || 'Back'}
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? t('saving') || 'Saving...' : t('saveAndFinish') || 'Save & Finish'}
        </Button>
      </div>

      {success && (
        <div className="mt-6 pt-6 border-t border-border">
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={onFinish}
          >
            {common('goToDashboard') || 'Go to Dashboard'}
          </Button>
        </div>
      )}
    </div>
  );
}
