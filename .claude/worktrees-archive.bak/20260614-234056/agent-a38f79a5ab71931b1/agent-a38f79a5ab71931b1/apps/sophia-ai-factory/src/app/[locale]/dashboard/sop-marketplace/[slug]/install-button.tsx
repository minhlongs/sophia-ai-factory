'use client';

/**
 * SopDetailInstallButton — client island on detail page to open install modal.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { SopInstallModal } from '@/forest/components/sop/sop-install-modal';
import type { SopTemplateRow } from '@/tree/sop/sop-types';

interface Props {
  template: SopTemplateRow;
  locale: string;
  alreadyInstalled: boolean;
  installAction: (formData: FormData) => Promise<{ error?: string }>;
}

export function SopDetailInstallButton({ template, locale, alreadyInstalled, installAction }: Props) {
  const t = useTranslations('sop');
  const [open, setOpen] = useState(false);

  if (alreadyInstalled) {
    return (
      <span className="px-4 py-2 text-sm rounded-lg bg-muted-800 text-muted-foreground-500 cursor-not-allowed select-none">
        {t('card.installed')}
      </span>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-primary-700 hover:bg-primary-600 shrink-0"
      >
        {t('detail.installNow')}
      </Button>
      <SopInstallModal
        template={template}
        locale={locale}
        open={open}
        onClose={() => setOpen(false)}
        installAction={installAction}
      />
    </>
  );
}
