'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  type PlaybookPageProps,
  type PlaybookTab,
  PlaybookHeaderTabs,
  PatternsSection,
  RulesSection,
  SchedulesSection,
  usePlaybookData,
} from './playbook';

export function PlaybookPage({
  userId = '',
  workspaceId = '',
  initialData,
}: PlaybookPageProps) {
  const t = useTranslations('dashboard.playbook');
  const [activeTab, setActiveTab] = useState<PlaybookTab>('patterns');

  const {
    data,
    loading,
    error,
    statusMessage,
    isTriggering,
    batchResult,
    loadData,
    handleToggleAutoApply,
    handleRollback,
    handleSaveSchedule,
    handleToggleSchedule,
    handleTriggerBatch,
  } = usePlaybookData(userId, workspaceId, initialData, t);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PlaybookHeaderTabs
        t={t}
        loading={loading}
        onRefresh={() => void loadData()}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        patternsCount={data.patterns.length}
        rulesCount={data.rules.length}
        schedulesCount={data.schedules.length}
      />

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg border bg-destructive/10 border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[35vh]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {activeTab === 'patterns' && (
            <PatternsSection patterns={data.patterns} t={t} />
          )}

          {activeTab === 'rules' && (
            <RulesSection
              rules={data.rules}
              t={t}
              onToggleAutoApply={handleToggleAutoApply}
              onRollback={handleRollback}
            />
          )}

          {activeTab === 'schedules' && (
            <SchedulesSection
              schedules={data.schedules}
              blueprints={data.blueprints}
              t={t}
              onSaveSchedule={handleSaveSchedule}
              onToggleSchedule={handleToggleSchedule}
              onTriggerBatch={handleTriggerBatch}
              isTriggering={isTriggering}
              batchResult={batchResult}
            />
          )}
        </>
      )}
    </div>
  );
}

// Backward compatibility alias
export const PlaybookClient = PlaybookPage;
export default PlaybookPage;
