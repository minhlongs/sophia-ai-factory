// i18n-namespace: dashboard.playbook
import React from 'react';
import { Button, Badge } from '@/components/stitch';
import { BookOpen, RefreshCw, TrendingUp, Layers, Calendar } from 'lucide-react';
import type { PlaybookTab, PlaybookTranslation } from './types';

interface PlaybookHeaderTabsProps {
  t: PlaybookTranslation;
  loading: boolean;
  onRefresh: () => void;
  activeTab: PlaybookTab;
  setActiveTab: (tab: PlaybookTab) => void;
  patternsCount: number;
  rulesCount: number;
  schedulesCount: number;
}

export function PlaybookHeaderTabs({
  t,
  loading,
  onRefresh,
  activeTab,
  setActiveTab,
  patternsCount,
  rulesCount,
  schedulesCount,
}: PlaybookHeaderTabsProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('detect')}
        </Button>
      </div>

      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('patterns')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
            activeTab === 'patterns'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          {t('tabs.patterns')}
          <Badge className="ml-1 text-xs px-1.5 py-0 bg-muted text-muted-foreground">
            {patternsCount}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="h-4 w-4" />
          {t('tabs.rules')}
          <Badge className="ml-1 text-xs px-1.5 py-0 bg-muted text-muted-foreground">
            {rulesCount}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
            activeTab === 'schedules'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          {t('tabs.schedules')}
          <Badge className="ml-1 text-xs px-1.5 py-0 bg-muted text-muted-foreground">
            {schedulesCount}
          </Badge>
        </button>
      </div>
    </>
  );
}
