/**
 * guide-workbench-labels.ts
 * Translates the workbench's `guide.workbench.*` keys into the two plain
 * serializable records the canvas and the inspector render. Keeping the ICU
 * counter values in one place is the point: those two strings carry placeholders,
 * so a call without values throws at render time and blanks the island.
 * Layer: app/[locale]/guide (client island helper; no JSX, no DOM)
 */

// i18n-namespace: guide

import type { GuideSchematicCanvasLabels, SimPhase } from './guide-schematic-nodes';
import type { GuideInspectorLabels } from './guide-focused-inspector';

/** The next-intl translator, narrowed to the keys this module is allowed to read. */
export interface Translate {
  (key: string, values?: Record<string, string>): string;
}

/**
 * The simulation states in display order, paired with the catalog's message-key
 * suffix. The UI state is upper-case (IDLE/INPUT/…) while the message key drops
 * the case (phaseIdle/phaseInput/…), so the pairing lives here rather than being
 * derived by string concatenation that silently assembles a missing key.
 */
const SIM_PHASES: readonly {
  readonly phase: SimPhase;
  readonly key: string;
}[] = [
  { phase: 'IDLE', key: 'Idle' },
  { phase: 'INPUT', key: 'Input' },
  { phase: 'ENGINE', key: 'Engine' },
  { phase: 'OUTPUT', key: 'Output' },
];

export function buildCanvasLabels(t: Translate): GuideSchematicCanvasLabels {
  return {
    stationPrefix: t('workbench.stationPrefix'),
    pillarPrefix: t('workbench.pillarPrefix'),
    selected: t('workbench.selected'),
    idle: t('workbench.idle'),
    simulate: t('workbench.simulateBtn'),
    stop: t('workbench.pauseBtn'),
    serialEmpty: t('workbench.serialEmpty'),
    canvasLabel: t('workbench.canvasLabel'),
    phases: Object.fromEntries(
      SIM_PHASES.map(({ phase, key }) => [phase, t(`workbench.phase${key}`)]),
    ) as Record<SimPhase, string>,
  };
}

export function buildInspectorLabels(t: Translate): GuideInspectorLabels {
  return {
    inputLabel: t('workbench.inputLabel'),
    engineLabel: t('workbench.engineLabel'),
    outputLabel: t('workbench.outputLabel'),
    capabilitiesLabel: t('workbench.capabilitiesLabel'),
    safetyLabel: t('workbench.safetyLabel'),
    proofLabel: t('workbench.proofLabel'),
    crossLinkLabel: t('workbench.crossLinkLabel'),
    previous: t('workbench.prevStation'),
    next: t('workbench.nextStation'),
    quickSelect: t('workbench.quickSelect'),
    // The counters carry {index}/{total}, so values are mandatory here.
    // Filling them with literal braces leaves the pure formatter to substitute
    // the real numbers.
    counterStage: t('workbench.counterStageFormat', { index: '{index}', total: '{total}' }),
    counterPillar: t('workbench.counterPillarFormat', { index: '{index}', total: '{total}' }),
  };
}
