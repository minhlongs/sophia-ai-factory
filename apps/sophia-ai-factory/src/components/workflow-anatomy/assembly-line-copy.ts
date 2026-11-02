// i18n-namespace: stitch.landing
/**
 * Localized Station & State Copy Helpers for CreativeAssemblyLine
 */

import type {
  WorkflowStationId,
  WorkflowStationState,
} from '@/tree/mission/workflow-view-model';

export function getStationText(
  t: (k: string) => string,
  id: WorkflowStationId,
): { title: string; shortTitle: string; summary: string } {
  switch (id) {
    case 'intake_brief':
      return {
        title: t('assemblyLine.stations.intake_brief.title'),
        shortTitle: t('assemblyLine.stations.intake_brief.shortTitle'),
        summary: t('assemblyLine.stations.intake_brief.summary'),
      };
    case 'script_planning':
      return {
        title: t('assemblyLine.stations.script_planning.title'),
        shortTitle: t('assemblyLine.stations.script_planning.shortTitle'),
        summary: t('assemblyLine.stations.script_planning.summary'),
      };
    case 'ceo_approval_gate':
      return {
        title: t('assemblyLine.stations.ceo_approval_gate.title'),
        shortTitle: t('assemblyLine.stations.ceo_approval_gate.shortTitle'),
        summary: t('assemblyLine.stations.ceo_approval_gate.summary'),
      };
    case 'media_render':
      return {
        title: t('assemblyLine.stations.media_render.title'),
        shortTitle: t('assemblyLine.stations.media_render.shortTitle'),
        summary: t('assemblyLine.stations.media_render.summary'),
      };
    case 'publish_ledger':
      return {
        title: t('assemblyLine.stations.publish_ledger.title'),
        shortTitle: t('assemblyLine.stations.publish_ledger.shortTitle'),
        summary: t('assemblyLine.stations.publish_ledger.summary'),
      };
  }
}

export function getStateText(t: (k: string) => string, state: WorkflowStationState): string {
  switch (state) {
    case 'not_started':
      return t('assemblyLine.states.not_started');
    case 'queued':
      return t('assemblyLine.states.queued');
    case 'running':
      return t('assemblyLine.states.running');
    case 'needs_approval':
      return t('assemblyLine.states.needs_approval');
    case 'succeeded':
      return t('assemblyLine.states.succeeded');
    case 'failed':
      return t('assemblyLine.states.failed');
    default:
      return t('assemblyLine.states.unknown');
  }
}
