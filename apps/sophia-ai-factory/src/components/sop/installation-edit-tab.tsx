'use client';

/**
 * InstallationEditTab — wraps PlaybookMarkdownEditor.
 * Passes save server action with installation ID bound.
 */

import { useTranslations } from 'next-intl';
import { PlaybookMarkdownEditor } from './playbook-markdown-editor';

interface Props {
  playbookMd: string;
  onSave: (value: string) => Promise<{ error?: string }>;
}

export function InstallationEditTab({ playbookMd, onSave }: Props) {
  const t = useTranslations('sop.edit');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
      </div>
      <PlaybookMarkdownEditor initialValue={playbookMd} onSave={onSave} />
    </div>
  );
}
