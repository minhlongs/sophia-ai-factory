'use client';

import { useTranslations } from 'next-intl';
import { Send, AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';
import { TEMPLATE_PACKS, type TemplatePack } from './types';

interface TemplatePackSelectorProps {
  onSelectTemplate: (pack: TemplatePack) => void;
}

export function TemplatePackSelector({ onSelectTemplate }: TemplatePackSelectorProps) {
  const t = useTranslations('setupWizard.whatsappTemplates');

  const categories = [
    { key: 'marketing' as const, label: t('categories.marketing') || 'Marketing', icon: Send },
    { key: 'notifications' as const, label: t('categories.notifications') || 'Notifications', icon: AlertTriangle },
    { key: 'support' as const, label: t('categories.support') || 'Support', icon: AlertCircle },
  ];

  return (
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
                  onClick={() => onSelectTemplate(pack)}
                  className="p-4 border border-border rounded-xl hover:border-primary hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground group-hover:text-primary">{pack.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pack.description}</p>
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
  );
}
