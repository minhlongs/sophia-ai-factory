'use client';

/**
 * PlaybookMarkdownEditor — lazy-loaded Markdown editor for SOP playbook.
 *
 * Day-1: simple <textarea> with live preview toggle.
 * The @uiw/react-md-editor is loaded dynamically ssr:false for bundle size.
 * Falls back gracefully if dynamic import fails.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Save, Eye, EyeOff } from 'lucide-react';
import { SopPreview } from './sop-preview';

interface PlaybookMarkdownEditorProps {
  initialValue: string;
  onSave: (value: string) => Promise<{ error?: string }>;
}

export function PlaybookMarkdownEditor({ initialValue, onSave }: PlaybookMarkdownEditorProps) {
  const t = useTranslations('sop.edit');
  const [value, setValue] = useState(initialValue);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await onSave(value);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('helpText')}</p>
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div className="min-h-64 p-4 bg-card border border-border rounded-lg">
          <SopPreview content={value} />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={20}
          className="w-full p-3 text-sm font-mono bg-zinc-900 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y"
          spellCheck={false}
        />
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-violet-700 hover:bg-violet-600"
        >
          <Save className="w-4 h-4 mr-2" />
          {isPending ? t('saving') : saved ? t('saved') : t('save')}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
