'use client';

import { useTransition, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { submitForReviewAction } from '../actions';
import { Send, CheckCircle2 } from 'lucide-react';

interface Props {
  templateId: string;
  status: 'draft' | 'published' | 'archived';
}

export function CreatorDetailClient({ templateId, status }: Props) {
  const t = useTranslations('sop.creator.detail');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'draft') return null;

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await submitForReviewAction(templateId);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
      {success ? (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-medium">{t('publishSuccess')}</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-white/60">{t('draftDescription')}</p>
          </div>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            {isPending ? t('publishing') : t('submitForReview')}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
