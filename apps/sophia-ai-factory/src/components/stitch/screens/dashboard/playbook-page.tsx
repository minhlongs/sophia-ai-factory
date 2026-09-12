'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Table,
} from '@/components/stitch';
import { Switch } from '@/seed/components/ui/switch';
import { BookOpen, Play, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';

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
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

interface Pattern {
  id: string;
  featureKey: string;
  featureValue: string;
  metric: string;
  avgMetric: number;
  sampleSize: number;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  source: 'experiment' | 'memory' | 'roi';
  detectedAt: number;
}

interface Rule {
  id: string;
  platform: string;
  goal: string;
  ruleVi: string;
  ruleEn: string;
  confidence: number;
  sampleSize: number;
  appliedCount: number;
  autoApply: boolean;
  rollbackCount: number;
}

interface PlaybookResponse {
  patterns: Pattern[];
  rules: Rule[];
}

const levelColor: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
};

function confidenceLevel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.9) return 'high';
  if (c >= 0.7) return 'medium';
  return 'low';
}

function PatternsTable({
  patterns,
  t,
}: {
  patterns: Pattern[];
  t: ReturnType<typeof useTranslations<'dashboard.playbook'>>;
}) {
  if (patterns.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-8 w-8" />}
        title={t('empty')}
        description={t('noData')}
      />
    );
  }

  return (
    <Table
      data={patterns}
      columns={[
        {
          key: 'feature',
          header: 'Feature',
          cell: (p) => `${p.featureKey}=${p.featureValue}`,
        },
        {
          key: 'metric',
          header: 'Metric',
          cell: (p) => p.metric,
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
          cell: (p) => p.sampleSize,
        },
        {
          key: 'detected',
          header: t('detectedAt'),
          cell: (p) => (
            <span className="text-muted-foreground text-xs">
              {new Date(p.detectedAt).toLocaleString()}
            </span>
          ),
        },
      ]}
      getRowId={(p) => p.id}
    />
  );
}

function RulesTable({
  rules,
  t,
  onToggle,
}: {
  rules: Rule[];
  t: ReturnType<typeof useTranslations<'dashboard.playbook'>>;
  onToggle: (r: Rule) => void;
}) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Play className="h-8 w-8" />}
        title={t('empty')}
        description={t('insufficientData')}
      />
    );
  }

  return (
    <Table
      data={rules}
      columns={[
        {
          key: 'platform',
          header: t('platform'),
          cell: (r) => r.platform,
        },
        {
          key: 'goal',
          header: t('goal'),
          cell: (r) => r.goal,
        },
        {
          key: 'rule',
          header: t('ruleEn'),
          cell: (r) => (
            <span className="max-w-xs truncate text-sm text-muted-foreground block">
              {r.ruleEn}
            </span>
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
          cell: (r) => r.appliedCount,
        },
        {
          key: 'autoApply',
          header: t('autoApply'),
          cell: (r) => (
            <Switch
              checked={r.autoApply}
              onCheckedChange={() => onToggle(r)}
            />
          ),
        },
        {
          key: 'rollbacks',
          header: t('rollbackCount'),
          cell: (r) => r.rollbackCount,
        },
      ]}
      getRowId={(r) => r.id}
    />
  );
}

export function PlaybookClient({ userId }: { userId: string }) {
  const t = useTranslations('dashboard.playbook');
  const [data, setData] = useState<PlaybookResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/playbook?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PlaybookResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  async function toggleAutoApply(rule: Rule) {
    try {
      await fetch('/api/v1/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          installationId: rule.id,
          enabled: !rule.autoApply,
        }),
      });
      await load();
    } catch {
      // non-fatal — state reverts on next load
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const patterns = data?.patterns ?? [];
  const rules = data?.rules ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-amber-500" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('detect')}
        </Button>
      </div>

      <PatternsTable patterns={patterns} t={t} />
      <RulesTable rules={rules} t={t} onToggle={toggleAutoApply} />
    </div>
  );
}