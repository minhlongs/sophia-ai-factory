'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/navigation';
import { Link } from '@/navigation';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import { AlertCircle, CheckCircle, XCircle, Edit2, ChevronRight, MessageCircle, Send, AlertTriangle } from 'lucide-react';

interface TemplatePack {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'notifications' | 'support';
  variables: string[];
  example: string;
}

const TEMPLATE_PACKS: TemplatePack[] = [
  {
    id: 'marketing_welcome',
    name: 'Marketing Welcome',
    description: 'Welcome new customers with a promotional offer',
    category: 'marketing',
    variables: ['customer_name', 'discount_code', 'expiry_date'],
    example: 'Hi {{customer_name}}, welcome to our store! Use code {{discount_code}} for 20% off. Expires {{expiry_date}}.',
  },
  {
    id: 'marketing_promo',
    name: 'Promotional Campaign',
    description: 'Announce a new product or sale',
    category: 'marketing',
    variables: ['product_name', 'promo_price', 'cta_link'],
    example: 'New arrival: {{product_name}} at just {{promo_price}}! Shop now: {{cta_link}}',
  },
  {
    id: 'marketing_abandoned_cart',
    name: 'Abandoned Cart Recovery',
    description: 'Recover lost sales with a gentle reminder',
    category: 'marketing',
    variables: ['customer_name', 'product_name', 'cart_link'],
    example: 'Hey {{customer_name}}, you left {{product_name}} in your cart. Complete your order: {{cart_link}}',
  },
  {
    id: 'notifications_order_confirmed',
    name: 'Order Confirmed',
    description: 'Confirm order details and delivery estimate',
    category: 'notifications',
    variables: ['order_id', 'customer_name', 'delivery_date'],
    example: 'Order {{order_id}} confirmed for {{customer_name}}. Expected delivery: {{delivery_date}}.',
  },
  {
    id: 'notifications_shipping_update',
    name: 'Shipping Update',
    description: 'Notify customer about shipment status',
    category: 'notifications',
    variables: ['order_id', 'tracking_number', 'carrier'],
    example: 'Your order {{order_id}} has shipped! Track with {{carrier}}: {{tracking_number}}',
  },
  {
    id: 'notifications_payment_received',
    name: 'Payment Received',
    description: 'Confirm payment receipt',
    category: 'notifications',
    variables: ['amount', 'payment_method', 'invoice_number'],
    example: 'Payment of {{amount}} received via {{payment_method}}. Invoice: {{invoice_number}}',
  },
  {
    id: 'support_ticket_created',
    name: 'Support Ticket Created',
    description: 'Acknowledge support request',
    category: 'support',
    variables: ['ticket_id', 'customer_name', 'estimated_response'],
    example: 'Hi {{customer_name}}, ticket {{ticket_id}} created. We\'ll respond within {{estimated_response}}.',
  },
  {
    id: 'support_issue_resolved',
    name: 'Issue Resolved',
    description: 'Notify customer that their issue is fixed',
    category: 'support',
    variables: ['ticket_id', 'customer_name', 'resolution_summary'],
    example: 'Ticket {{ticket_id}} resolved for {{customer_name}}. Summary: {{resolution_summary}}',
  },
];

export function WhatsAppTemplatesClient() {
  const t = useTranslations('setupWizard.whatsappTemplates');
  const common = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePack | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'select' | 'edit' | 'confirm'>('select');

  const categories = [
    { key: 'marketing', label: t('categories.marketing') || 'Marketing', icon: Send },
    { key: 'notifications', label: t('categories.notifications') || 'Notifications', icon: AlertTriangle },
    { key: 'support', label: t('categories.support') || 'Support', icon: AlertCircle },
  ];

  const filteredPacks = selectedTemplate
    ? TEMPLATE_PACKS.filter((p) => p.id === selectedTemplate.id)
    : TEMPLATE_PACKS;

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
      // Credentials are stored server-side in whatsapp_templates.
      // Client only sends template selection — server resolves credentials by user + template.
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
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/${locale}/dashboard/setup`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            {common('back') || 'Back to Setup'}
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('title') || 'WhatsApp Template Selection'}</h1>
              <p className="text-muted-foreground mt-1">
                {t('subtitle') || 'Choose a pre-built template pack and customize it for your WhatsApp campaigns'}
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['select', 'edit', 'confirm'].map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  step === s
                    ? 'bg-primary border-primary text-primary-foreground'
                    : ['edit', 'confirm'].indexOf(step) > ['select', 'edit', 'confirm'].indexOf(s)
                    ? 'bg-muted border-muted text-muted-foreground'
                    : 'bg-background border-primary text-primary'
                )}
              >
                {['edit', 'confirm'].indexOf(step) > ['select', 'edit', 'confirm'].indexOf(s) ? (
                  <CheckCircle className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <span className="font-semibold">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'hidden sm:block text-sm font-medium',
                  step === s ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {t(`steps.${s}`) || s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 2 && (
                <div
                  className={cn(
                    'hidden md:block w-20 h-1 rounded-full',
                    ['edit', 'confirm'].indexOf(step) > i ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {success && step === 'confirm' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{t('successMessage') || 'Template saved successfully! You can now use it in your campaigns.'}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          {step === 'select' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">{t('selectTemplate') || 'Select a Template Pack'}</h2>
              <p className="text-muted-foreground mb-6">
                {t('selectTemplateHelp') || 'Choose from pre-built templates across Marketing, Notifications, and Support categories'}
              </p>

              <div className="space-y-6">
                {categories.map((cat) => (
                  <div key={cat.key}>
                    <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                      <cat.icon className="w-5 h-5 text-primary" aria-hidden="true" />
                      {cat.label}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {TEMPLATE_PACKS.filter((p) => p.category === cat.key).map((pack) => (
                        <button
                          key={pack.id}
                          onClick={() => handleSelectTemplate(pack)}
                          className="p-4 border border-border rounded-xl hover:border-primary hover:shadow-md transition-all text-left group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground group-hover:text-primary">
                                {pack.name}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {pack.description}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              {t('variables') || 'Variables'}: {pack.variables.join(', ')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'edit' && selectedTemplate && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{t('editTemplate') || 'Customize Template'}</h2>
                  <p className="text-muted-foreground mt-1">
                    {t('editTemplateHelp') || 'Fill in the variables below to personalize your template'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                  {selectedTemplate.name}
                </span>
              </div>

              <div className="space-y-4">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable} className="space-y-2">
                    <label
                      htmlFor={variable}
                      className="block text-sm font-medium text-foreground"
                    >
                      {variable.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </label>
                    <input
                      id={variable}
                      type="text"
                      value={variables[variable] || ''}
                      onChange={(e) => handleVariableChange(variable, e.target.value)}
                      placeholder={t(`variables.${variable}.placeholder`) || `Enter ${variable.replace(/_/g, ' ')}`}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    {t(`variables.${variable}.help`) && (
                      <p className="text-xs text-muted-foreground">{t(`variables.${variable}.help`)}</p>
                    )}
                  </div>
                ))}

                {/* Preview */}
                <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                    {t('preview') || 'Preview'}
                  </h4>
                  <p className="text-sm text-foreground font-mono whitespace-pre-wrap bg-background p-3 rounded border border-border">
                    {selectedTemplate.example
                      .replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match)}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-border">
                <button
                  onClick={handleBack}
                  className="px-6 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  {common('back') || 'Back'}
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  {common('next') || 'Continue'}
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && selectedTemplate && (
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
                    <dd className="font-medium">{selectedTemplate.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('category') || 'Category'}</dt>
                    <dd className="font-medium capitalize">{selectedTemplate.category}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('variablesFilled') || 'Variables Filled'}</dt>
                    <dd className="font-medium">
                      {Object.values(variables).filter(Boolean).length} / {selectedTemplate.variables.length}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={handleBack}
                  className="px-6 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  {common('back') || 'Back'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? t('saving') || 'Saving...'
                    : t('saveAndFinish') || 'Save & Finish'}
                </button>
              </div>

              {success && (
                <div className="mt-6 pt-6 border-t border-border">
                  <button
                    onClick={handleFinish}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {common('goToDashboard') || 'Go to Dashboard'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}