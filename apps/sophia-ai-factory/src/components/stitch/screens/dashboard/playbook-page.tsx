'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Button,
  Table,
  Input,
} from '@/components/stitch';
import { Switch } from '@/seed/components/ui/switch';
import {
  BookOpen,
  Play,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Clock,
  Mic,
  Film,
  CheckCircle2,
} from 'lucide-react';
import {
  getPlaybookOverviewAction,
  toggleRuleAutoApplyAction,
  rollbackRuleAction,
  saveRecurringScheduleAction,
  toggleRecurringScheduleAction,
  triggerBatchRunAction,
  type PlaybookOverviewData,
} from '@/land/playbook/actions';
import type {
  PlaybookPattern,
  PlaybookRule,
  CampaignBlueprint,
  RecurringCampaignSchedule,
} from '@/seed/types/playbook-pattern';
import type { MissionPreflightResult } from '@/tree/mission/preflight-check';

// ── Types & Helpers ──────────────────────────────────────────────────────────

export interface PlaybookPageProps {
  userId?: string;
  workspaceId?: string;
  initialData?: PlaybookOverviewData | null;
}

const levelColor: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20',
};

function confidenceLevel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground mb-3">{icon}</div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

// ── Tab 1: Patterns Table Component ──────────────────────────────────────────

function PatternsSection({
  patterns,
  t,
}: {
  patterns: PlaybookPattern[];
  t: ReturnType<typeof useTranslations<'dashboard.playbook'>>;
}) {
  const hookPatterns = patterns.filter(
    (p) => p.featureKey === 'hook_style' || p.featureKey === 'hook_type',
  );
  const voicePatterns = patterns.filter(
    (p) => p.featureKey === 'voice_style' || p.featureKey === 'voice_profile',
  );
  const durationPatterns = patterns.filter(
    (p) => p.featureKey === 'duration' || p.featureKey === 'duration_pattern',
  );

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<TrendingUp className="h-10 w-10 text-muted-foreground" />}
            title={t('empty')}
            description={t('noData')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dimension Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              {t('hookStyles')} ({hookPatterns.length})
            </div>
          </CardHeader>
          <CardContent>
            {hookPatterns.length > 0 ? (
              <div className="space-y-2">
                {hookPatterns.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{p.featureValue}</span>
                    <Badge className={levelColor[p.confidenceLevel]}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              {t('voiceProfiles')} ({voicePatterns.length})
            </div>
          </CardHeader>
          <CardContent>
            {voicePatterns.length > 0 ? (
              <div className="space-y-2">
                {voicePatterns.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{p.featureValue}</span>
                    <Badge className={levelColor[p.confidenceLevel]}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {t('durationPatterns')} ({durationPatterns.length})
            </div>
          </CardHeader>
          <CardContent>
            {durationPatterns.length > 0 ? (
              <div className="space-y-2">
                {durationPatterns.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{p.featureValue}</span>
                    <Badge className={levelColor[p.confidenceLevel]}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Patterns Table */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">{t('tabs.patterns')}</h3>
        </CardHeader>
        <CardContent>
          <Table
            data={patterns}
            columns={[
              {
                key: 'feature',
                header: 'Feature',
                cell: (p) => (
                  <div className="flex flex-col">
                    <span className="font-mono font-semibold text-sm">{p.featureValue}</span>
                    <span className="text-xs text-muted-foreground">{p.featureKey}</span>
                  </div>
                ),
              },
              {
                key: 'metric',
                header: 'Metric',
                cell: (p) => (
                  <div className="text-sm">
                    <span className="font-medium">{p.metric.toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {(p.avgMetric * 100).toFixed(1)}%
                    </span>
                  </div>
                ),
              },
              {
                key: 'confidence',
                header: t('confidence'),
                cell: (p) => (
                  <Badge className={levelColor[p.confidenceLevel]}>
                    {t(p.confidenceLevel)} ({Math.round(p.confidence * 100)}%)
                  </Badge>
                ),
              },
              {
                key: 'sample',
                header: t('sample'),
                cell: (p) => <span className="text-sm">{p.sampleSize}</span>,
              },
              {
                key: 'detected',
                header: t('detectedAt'),
                cell: (p) => (
                  <span className="text-xs text-muted-foreground">
                    {p.detectedAt > 0 ? new Date(p.detectedAt).toLocaleDateString() : '—'}
                  </span>
                ),
              },
            ]}
            getRowId={(p) => p.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 2: Rules Section Component ───────────────────────────────────────────

function RulesSection({
  rules,
  t,
  onToggleAutoApply,
  onRollback,
}: {
  rules: PlaybookRule[];
  t: ReturnType<typeof useTranslations<'dashboard.playbook'>>;
  onToggleAutoApply: (rule: PlaybookRule) => void;
  onRollback: (rule: PlaybookRule) => void;
}) {
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
                <Badge className={levelColor[confidenceLevel(r.confidence)]}>
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

// ── Tab 3: Campaign Schedules Section ────────────────────────────────────────

function SchedulesSection({
  schedules,
  blueprints,
  t,
  onSaveSchedule,
  onToggleSchedule,
  onTriggerBatch,
  isTriggering,
  batchResult,
}: {
  schedules: RecurringCampaignSchedule[];
  blueprints: CampaignBlueprint[];
  t: ReturnType<typeof useTranslations<'dashboard.playbook'>>;
  onSaveSchedule: (params: {
    blueprintId: string;
    scheduleCron: string;
    batchSize: number;
    isActive: boolean;
  }) => Promise<void>;
  onToggleSchedule: (schedule: RecurringCampaignSchedule) => void;
  onTriggerBatch: (blueprintId: string, batchSize: number) => Promise<void>;
  isTriggering: boolean;
  batchResult: { batchId: string; missionIds: string[]; preflight?: MissionPreflightResult } | null;
}) {
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(
    blueprints[0]?.id || 'bp-default',
  );
  const [cronInterval, setCronInterval] = useState<string>('0 0 */7 * *');
  const [batchSize, setBatchSize] = useState<number>(3);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (blueprints.length > 0 && !selectedBlueprintId) {
      setSelectedBlueprintId(blueprints[0].id);
    }
  }, [blueprints, selectedBlueprintId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSchedule({
        blueprintId: selectedBlueprintId,
        scheduleCron: cronInterval,
        batchSize,
        isActive: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrigger = async () => {
    await onTriggerBatch(selectedBlueprintId, batchSize);
  };

  return (
    <div className="space-y-6">
      {/* Automation & Schedule Form Card */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t('scheduleSectionTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('scheduleSectionSubtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Blueprint Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t('blueprint')}</label>
              <select
                value={selectedBlueprintId}
                onChange={(e) => setSelectedBlueprintId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {blueprints.length > 0 ? (
                  blueprints.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name?.en || bp.id} ({bp.targetPlatform})
                    </option>
                  ))
                ) : (
                  <option value="bp-default">{t('selectBlueprint')}</option>
                )}
              </select>
            </div>

            {/* Recurrence Interval */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t('interval')}</label>
              <select
                value={cronInterval}
                onChange={(e) => setCronInterval(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="0 0 * * *">{t('everyDay')}</option>
                <option value="0 0 */3 * *">{t('threeDays')}</option>
                <option value="0 0 * * 0">{t('weekly')}</option>
                <option value="0 0 */14 * *">{t('twoWeeks')}</option>
                <option value="0 0 1 * *">{t('monthly')}</option>
              </select>
            </div>

            {/* Batch Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t('batchSize')}</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 1)}
                className="h-9"
              />
            </div>
          </div>

          {/* 7-Gate Preflight Preview Bar */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs font-semibold text-foreground">{t('preflightPreview')}</p>
                <p className="text-xs text-muted-foreground">{t('preflightReady')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('preflightValid')}
              </Badge>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              {isSaving ? t('saving') : t('saveSchedule')}
            </Button>
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={isTriggering}
              className="h-9 bg-primary text-primary-foreground"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {isTriggering ? t('triggering') : t('triggerBatch')}
            </Button>
          </div>

          {/* Batch Run Result Display */}
          {batchResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('batchTriggered')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Batch ID: <span className="font-mono text-foreground">{batchResult.batchId}</span> |
                Missions Created:{' '}
                <span className="font-mono text-foreground">
                  {batchResult.missionIds.length}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Schedules Table */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">{t('tabs.schedules')}</h3>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-10 w-10 text-muted-foreground" />}
              title={t('noSchedules')}
              description={t('scheduleSectionSubtitle')}
            />
          ) : (
            <Table
              data={schedules}
              columns={[
                {
                  key: 'blueprint',
                  header: t('blueprint'),
                  cell: (s) => (
                    <span className="font-mono font-medium text-sm">
                      {s.blueprintId}
                    </span>
                  ),
                },
                {
                  key: 'interval',
                  header: t('interval'),
                  cell: (s) => (
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.scheduleCron}
                    </span>
                  ),
                },
                {
                  key: 'batchSize',
                  header: t('batchSize'),
                  cell: (s) => <span className="text-sm font-medium">{s.batchSize}</span>,
                },
                {
                  key: 'nextRun',
                  header: t('nextRun'),
                  cell: (s) => (
                    <span className="text-xs text-muted-foreground">
                      {s.nextRunAt > 0 ? new Date(s.nextRunAt).toLocaleDateString() : '—'}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: t('status'),
                  cell: (s) => (
                    <Badge
                      className={
                        s.isActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                      }
                    >
                      {s.isActive ? t('active') : t('paused')}
                    </Badge>
                  ),
                },
                {
                  key: 'toggle',
                  header: t('actions'),
                  cell: (s) => (
                    <Switch
                      checked={s.isActive}
                      onCheckedChange={() => onToggleSchedule(s)}
                      aria-label={`Toggle schedule ${s.id}`}
                    />
                  ),
                },
              ]}
              getRowId={(s) => s.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Exported Component ──────────────────────────────────────────────────

export function PlaybookPage({
  userId = '',
  workspaceId = '',
  initialData,
}: PlaybookPageProps) {
  const t = useTranslations('dashboard.playbook');

  const [activeTab, setActiveTab] = useState<'patterns' | 'rules' | 'schedules'>('patterns');
  const [data, setData] = useState<PlaybookOverviewData>({
    patterns: initialData?.patterns ?? [],
    rules: initialData?.rules ?? [],
    blueprints: initialData?.blueprints ?? [],
    schedules: initialData?.schedules ?? [],
  });

  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    batchId: string;
    missionIds: string[];
    preflight?: MissionPreflightResult;
  } | null>(null);

  const loadData = async () => {
    const ws = workspaceId || userId;
    if (!ws) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPlaybookOverviewAction(ws);
      if (!res.success) {
        setError(res.error || 'Failed to fetch playbook overview');
      } else {
        setData(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching playbook data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [workspaceId, userId]);

  // Handle auto-apply switch with OCC CAS
  const handleToggleAutoApply = async (rule: PlaybookRule) => {
    const nextEnabled = !rule.autoApply;
    setStatusMessage(null);

    // Call server action with OCC CAS expectedUpdatedAt
    const res = await toggleRuleAutoApplyAction(rule.id, nextEnabled, rule.updatedAt);

    if (!res.success) {
      if (res.code === 'CAS_CONFLICT') {
        setStatusMessage({ type: 'error', text: t('casConflict') });
        // Refresh to fetch latest state
        void loadData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Update failed' });
      }
      return;
    }

    setData((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === rule.id
          ? { ...r, autoApply: nextEnabled, updatedAt: res.data.updatedAt }
          : r,
      ),
    }));
    setStatusMessage({ type: 'success', text: t('ruleUpdated') });
  };

  // Handle rule rollback
  const handleRollback = async (rule: PlaybookRule) => {
    setStatusMessage(null);
    const res = await rollbackRuleAction(rule.id);

    if (!res.success) {
      setStatusMessage({ type: 'error', text: res.error || 'Rollback failed' });
      return;
    }

    setData((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === rule.id
          ? {
              ...r,
              autoApply: false,
              rollbackCount: res.data.rollbackCount,
            }
          : r,
      ),
    }));
    setStatusMessage({ type: 'success', text: t('ruleRolledBack') });
  };

  // Handle schedule save
  const handleSaveSchedule = async (params: {
    blueprintId: string;
    scheduleCron: string;
    batchSize: number;
    isActive: boolean;
  }) => {
    const ws = workspaceId || userId;
    const res = await saveRecurringScheduleAction({
      workspaceId: ws,
      blueprintId: params.blueprintId,
      scheduleCron: params.scheduleCron,
      batchSize: params.batchSize,
      isActive: params.isActive,
    });

    if (res.success) {
      setStatusMessage({ type: 'success', text: t('scheduleCreated') });
      void loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to save schedule' });
    }
  };

  // Handle schedule toggle
  const handleToggleSchedule = async (schedule: RecurringCampaignSchedule) => {
    const nextActive = !schedule.isActive;
    const res = await toggleRecurringScheduleAction(schedule.id, nextActive);

    if (res.success) {
      setData((prev) => ({
        ...prev,
        schedules: prev.schedules.map((s) =>
          s.id === schedule.id ? { ...s, isActive: nextActive } : s,
        ),
      }));
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to toggle schedule' });
    }
  };

  // Handle trigger batch run
  const handleTriggerBatch = async (blueprintId: string, batchSize: number) => {
    setIsTriggering(true);
    setBatchResult(null);
    setStatusMessage(null);

    try {
      const ws = workspaceId || userId;
      const res = await triggerBatchRunAction({
        workspaceId: ws,
        blueprintId,
        batchSize,
      });

      if (!res.success) {
        setStatusMessage({
          type: 'error',
          text: res.error || t('preflightError'),
        });
        return;
      }

      setBatchResult(res.data);
      setStatusMessage({ type: 'success', text: t('batchTriggered') });
      void loadData();
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('detect')}
        </Button>
      </div>

      {/* Notifications / Banners */}
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

      {/* Tabs Navigation */}
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
            {data.patterns.length}
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
            {data.rules.length}
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
            {data.schedules.length}
          </Badge>
        </button>
      </div>

      {/* Tab Panels */}
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