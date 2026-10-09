// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Badge, Button, Table } from '@/components/stitch';
import { Switch } from '@/seed/components/ui/switch';
import { Play, RotateCcw } from 'lucide-react';
import type { PlaybookRule } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation } from './types';
import { LEVEL_COLOR, getConfidenceLevel, EmptyState } from './empty-state';

interface RulesSectionProps {
  rules: PlaybookRule[];
  t: PlaybookTranslation;
  onToggleAutoApply: (rule: PlaybookRule) => void;
  onRollback: (rule: PlaybookRule) => void;
}

export function RulesSection({
  rules,
  t,
  onToggleAutoApply,
  onRollback,
}: RulesSectionProps) {
  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<Play className="h-10 w-10 text-muted-foreground" />}
            title={t('noRules')}
            description={t('insufficientData')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold">{t('tabs.rules')}</h3>
      </CardHeader>
      <CardContent>
        <Table
          variant="embedded"
          data={rules}
          columns={[
            {
              key: 'platform',
              header: t('platform'),
              cell: (r) => (
                <div className="flex flex-col">
                  <span className="font-semibold text-sm capitalize">{r.platform}</span>
                  <span className="text-xs text-muted-foreground capitalize">{r.goal}</span>
                </div>
              ),
            },
            {
              key: 'rule',
              header: 'Rule (Bilingual)',
              cell: (r) => (
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-medium text-foreground">{r.ruleEn}</p>
                  <p className="text-xs text-muted-foreground italic">{r.ruleVi}</p>
                </div>
              ),
            },
            {
              key: 'confidence',
              header: t('confidence'),
              cell: (r) => (
                <Badge className={LEVEL_COLOR[getConfidenceLevel(r.confidence)]}>
                  {Math.round(r.confidence * 100)}%
                </Badge>
              ),
            },
            {
              key: 'applied',
              header: t('appliedCount'),
              cell: (r) => <span className="text-sm font-medium">{r.appliedCount}</span>,
            },
            {
              key: 'autoApply',
              header: t('autoApply'),
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.autoApply}
                    onCheckedChange={() => onToggleAutoApply(r)}
                    aria-label={`Toggle auto-apply for ${r.id}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {r.autoApply ? t('active') : t('paused')}
                  </span>
                </div>
              ),
            },
            {
              key: 'rollbacks',
              header: t('rollbackCount'),
              cell: (r) => <span className="text-sm text-muted-foreground">{r.rollbackCount}</span>,
            },
            {
              key: 'actions',
              header: t('actions'),
              cell: (r) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRollback(r)}
                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('rollback')}
                </Button>
              ),
            },
          ]}
          getRowId={(r) => r.id}
        />
      </CardContent>
    </Card>
  );
}
