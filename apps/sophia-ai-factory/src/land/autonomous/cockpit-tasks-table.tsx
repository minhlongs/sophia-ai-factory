'use client';

/**
 * Autonomous Operations Cockpit - Automated Workflows & Tasks Table
 *
 * @module land/autonomous/cockpit-tasks-table
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Layers, XCircle } from 'lucide-react';
import type { AutonomousScheduleTaskRow } from '@/seed/types/autonomous-engine';

interface CockpitTasksTableProps {
  tasks: AutonomousScheduleTaskRow[];
}

export function CockpitTasksTable({ tasks }: CockpitTasksTableProps) {
  const t = useTranslations('autonomous');

  const getTaskFriendlyName = (skillName: string) => {
    switch (skillName) {
      case 'affiliate-scout':
        return t('tasks.affiliateScout');
      case 'content-producer':
        return t('tasks.contentProducer');
      case 'auto-publisher':
        return t('tasks.autoPublisher');
      default:
        return skillName;
    }
  };

  return (
    <div className="p-6 bg-card border border-border rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          {t('tasks.title')}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium">{t('tasks.name')}</th>
              <th className="px-4 py-3 font-medium">{t('tasks.schedule')}</th>
              <th className="px-4 py-3 font-medium">{t('tasks.tier')}</th>
              <th className="px-4 py-3 font-medium">{t('tasks.priority')}</th>
              <th className="px-4 py-3 font-medium">{t('tasks.nextRun')}</th>
              <th className="px-4 py-3 font-medium">{t('tasks.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3.5 font-medium text-foreground">
                  <div>{getTaskFriendlyName(task.skill_name)}</div>
                  <div className="text-xs text-muted-foreground font-mono">{task.skill_name}</div>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  <span className="capitalize">{task.schedule_type}</span>
                  {task.schedule_expression && (
                    <span className="ml-1.5 font-mono text-xs text-primary">
                      ({task.schedule_expression})
                    </span>
                  )}
                  {task.interval_seconds && (
                    <span className="ml-1.5 text-xs">({task.interval_seconds}s)</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-secondary text-secondary-foreground">
                    {task.tier_requirement}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">P{task.priority}</td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs">
                  {task.next_run_at ? new Date(task.next_run_at * 1000).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3.5">
                  {task.enabled ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('tasks.enabled')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      {t('tasks.disabled')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
