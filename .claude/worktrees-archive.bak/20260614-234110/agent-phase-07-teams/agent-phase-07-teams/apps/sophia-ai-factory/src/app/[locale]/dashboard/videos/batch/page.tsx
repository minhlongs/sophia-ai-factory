'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BatchUploadForm } from './components/batch-upload-form';
import { BatchProgressDashboard } from './components/batch-progress-dashboard';

export default function BatchPage() {
  const t = useTranslations('batch');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {!activeBatchId ? (
        <BatchUploadForm onBatchCreated={setActiveBatchId} />
      ) : (
        <BatchProgressDashboard batchId={activeBatchId} />
      )}
    </div>
  );
}
