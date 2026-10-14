/**
 * Launch helper for First-Run Wizard mission creation and execution dispatch.
 * @module components/missions/first-run/wizard-launch-helper
 */

import type { FirstRunTemplate } from '@/land/missions/first-run-template';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import { createMission } from '@/land/creative-mission/actions';
import {
  buildCreateMissionInput,
  resolveExecutionTemplate,
  triggerExecutionAction,
} from './execution-helper';

export interface LaunchWizardMissionParams {
  workspaceId: string;
  topic: string;
  selectedTemplate: FirstRunTemplate;
  locale: 'vi' | 'en';
  budgetCents: number;
  estimatedUsd: number;
  initialBlueprint?: MarketplaceBlueprintItem | null;
  isMounted: () => boolean;
  onCreated: (missionId: string) => void;
  onError: (errorMessage: string) => void;
  defaultLaunchError: string;
}

export async function launchWizardMission(params: LaunchWizardMissionParams): Promise<void> {
  const {
    workspaceId,
    topic,
    selectedTemplate,
    locale,
    budgetCents,
    estimatedUsd,
    initialBlueprint,
    isMounted,
    onCreated,
    onError,
    defaultLaunchError,
  } = params;

  try {
    const missionInput = buildCreateMissionInput({
      workspaceId,
      topic,
      template: selectedTemplate,
      locale,
      budgetCents,
      blueprint: initialBlueprint,
    });

    const createRes = await createMission(missionInput);
    if (!createRes.ok) {
      onError(createRes.error.message || defaultLaunchError);
      return;
    }

    const newId = createRes.value.missionId;
    onCreated(newId);

    const execTmpl = resolveExecutionTemplate(selectedTemplate, initialBlueprint);
    triggerExecutionAction(
      newId,
      topic,
      execTmpl,
      estimatedUsd,
      isMounted,
      (execError) => {
        if (execError) {
          onError(execError);
        }
      },
    );
  } catch {
    onError(defaultLaunchError);
  }
}
