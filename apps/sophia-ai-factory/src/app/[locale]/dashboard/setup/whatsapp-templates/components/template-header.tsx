'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { ChevronRight, MessageCircle } from 'lucide-react';

export function TemplateHeader() {
  const t = useTranslations('setupWizard.whatsappTemplates');
  const common = useTranslations('common');
  const locale = useLocale();

  return (
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
  );
}
