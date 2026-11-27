// i18n-namespace: stitch.campaigns
'use client';

import React from 'react';
import { Link } from '@/navigation';

interface CampaignsPageFooterProps {
  t: (key: string) => string;
}

const FOOTER_LINK_CLASS = 'text-xs text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors';

export function CampaignsPageFooter({ t }: CampaignsPageFooterProps) {
  return (
    <footer className="mt-auto pt-8 pb-4 border-t border-border/50 dark:border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
      <span>{t('footer.copyright')}</span>
      <div className="flex gap-6">
        <Link href="/guide" className={FOOTER_LINK_CLASS}>{t('footer.apiDocs')}</Link>
        <Link href="/privacy" className={FOOTER_LINK_CLASS}>{t('footer.privacy')}</Link>
        <Link href="/terms" className={FOOTER_LINK_CLASS}>{t('footer.terms')}</Link>
      </div>
    </footer>
  );
}
