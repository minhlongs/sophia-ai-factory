// i18n-namespace: stitch.campaigns
'use client';

import React from 'react';

interface CampaignsPageFooterProps {
  t: (key: string) => string;
}

const FOOTER_LINK_CLASS = 'text-xs text-muted-foreground hover:text-foreground transition-colors';

export function CampaignsPageFooter({ t }: CampaignsPageFooterProps) {
  return (
    <footer className="mt-auto pt-8 pb-4 flex items-center justify-between text-xs text-muted-foreground">
      <span>{t('footer.copyright')}</span>
      <div className="flex gap-6">
        <a href="#" className={FOOTER_LINK_CLASS}>{t('footer.apiDocs')}</a>
        <a href="#" className={FOOTER_LINK_CLASS}>{t('footer.privacy')}</a>
        <a href="#" className={FOOTER_LINK_CLASS}>{t('footer.terms')}</a>
      </div>
    </footer>
  );
}
