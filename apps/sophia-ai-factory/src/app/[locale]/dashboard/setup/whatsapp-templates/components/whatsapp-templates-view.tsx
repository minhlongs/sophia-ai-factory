'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/navigation';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/seed/components/ui/alert';
import type { TemplatePack, TemplateStep } from './types';
import { StepIndicator } from './step-indicator';
import { TemplateHeader } from './template-header';
import { TemplatePackSelector } from './template-pack-selector';
import { TemplateEditor } from './template-editor';
import { TemplateConfirmation } from './template-confirmation';

export function WhatsAppTemplatesView() {
  const t = useTranslations('setupWizard.whatsappTemplates');
  const locale = useLocale();
  const router = useRouter();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePack | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<TemplateStep>('select');

  const handleSelectTemplate = (pack: TemplatePack) => {
    setSelectedTemplate(pack);
    setVariables(pack.variables.reduce((acc, v) => ({ ...acc, [v]: '' }), {}));
    setStep('edit');
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('edit');
    } else if (step === 'edit') {
      setSelectedTemplate(null);
      setVariables({});
      setStep('select');
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/setup-wizard/save-whatsapp-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, variables }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || t('errors.saveFailed') || 'Failed to save template');
      }

      setSuccess(true);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed') || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    router.push(`/${locale}/dashboard`);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <TemplateHeader />
        <StepIndicator currentStep={step} />

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && step === 'confirm' && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-700">
            <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
            <AlertDescription>
              {t('successMessage') || 'Template saved successfully! You can now use it in your campaigns.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          {step === 'select' && (
            <TemplatePackSelector onSelectTemplate={handleSelectTemplate} />
          )}

          {step === 'edit' && selectedTemplate && (
            <TemplateEditor
              template={selectedTemplate}
              variables={variables}
              onVariableChange={handleVariableChange}
              onBack={handleBack}
              onContinue={() => setStep('confirm')}
            />
          )}

          {step === 'confirm' && selectedTemplate && (
            <TemplateConfirmation
              template={selectedTemplate}
              variables={variables}
              isSubmitting={isSubmitting}
              success={success}
              onBack={handleBack}
              onSubmit={handleSubmit}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}
