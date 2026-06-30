import React from 'react';
import { AlertCircle, Cloud, Check, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ByokDoctrineBanner } from '@/tree/components/setup-wizard/byok-doctrine-banner';

export function SystemCheckStep() {
  const t = useTranslations('setup_wizard.system_check');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <ByokDoctrineBanner />
      <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
      <div className="grid gap-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Cloud className="text-foreground" />
            <div>
              <p className="font-medium text-foreground">{t('cloudflare_workers')}</p>
              <p className="text-sm text-muted-foreground">{t('cloudflare_desc')}</p>
            </div>
          </div>
          <Check className="text-foreground" />
        </div>
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Shield className="text-foreground" />
            <div>
              <p className="font-medium text-foreground">{t('security')}</p>
              <p className="text-sm text-muted-foreground">{t('security_desc')}</p>
            </div>
          </div>
          <Check className="text-foreground" />
        </div>
      </div>
      <div className="bg-accent/10 border border-accent/20 p-4 rounded-lg text-sm text-accent flex gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <p>{t('next_step')}</p>
      </div>
    </div>
  );
}
