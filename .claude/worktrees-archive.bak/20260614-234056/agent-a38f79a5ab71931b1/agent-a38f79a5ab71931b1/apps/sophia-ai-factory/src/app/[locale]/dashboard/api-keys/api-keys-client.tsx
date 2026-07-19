/**
 * API Keys Dashboard Page
 *
 * Combines ApiKeyList + create/show modals.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyList } from '@/forest/components/raas/api-key-list';
import { ApiKeyCreateModal, ApiKeyShowModal } from '@/forest/components/raas/api-key-create-modal';

export default function ApiKeysClient() {
  const t = useTranslations('dashboard.apiKeys');
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleKeyCreated(key: string) {
    setCreatedKey(key);
    setShowCreate(false);
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('page_title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
      </div>

      <ApiKeyList
        onCreateKey={() => setShowCreate(true)}
        refreshTrigger={refreshTrigger}
      />

      {showCreate && (
        <ApiKeyCreateModal
          onCreated={handleKeyCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {createdKey && (
        <ApiKeyShowModal
          apiKey={createdKey}
          onDone={() => setCreatedKey(null)}
        />
      )}
    </div>
  );
}
