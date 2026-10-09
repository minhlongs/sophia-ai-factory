/**
 * First-Run Wizard Main Component
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/first-run-wizard
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { getFirstRunTemplates } from '@/land/missions/first-run-template';
import { MissionProgressBar } from '../mission-progress-bar';
import type { FirstRunWizardProps } from './types';
import { useWizardFlow } from './use-wizard-flow';
import { CeoQuestionsGuide } from './ceo-questions-guide';
import { CompletionCard } from './completion-card';
import { RemixCostBanner } from './remix-cost-banner';
import { TemplateConfigurator } from './template-configurator';

export function FirstRunWizard(props: FirstRunWizardProps) {
  const { locale = 'vi', initialBlueprint } = props;
  const t = useTranslations('dashboard.missions.wizard');
  const templates = getFirstRunTemplates();

  const {
    selectedTemplate,
    setSelectedTemplate,
    topic,
    setTopic,
    status,
    setStatus,
    currentStage,
    missionId,
    errorMessage,
    blueprintCost,
    isAllowed,
    missingMcu,
    costEstimate,
    handleLaunch,
  } = useWizardFlow(props, templates, t);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {initialBlueprint && blueprintCost && (
        <RemixCostBanner
          t={t}
          initialBlueprint={initialBlueprint}
          blueprintCost={blueprintCost}
          initialMcuBalance={props.initialMcuBalance ?? 0}
          isAllowed={isAllowed}
          missingMcu={missingMcu}
        />
      )}
      <CeoQuestionsGuide t={t} costEstimate={costEstimate} />
      {status !== 'idle' ? (
        <div className="space-y-4">
          <MissionProgressBar
            currentStage={currentStage}
            status={status}
            errorMessage={errorMessage}
            onRetry={handleLaunch}
            locale={locale}
          />
          {status === 'completed' && (
            <CompletionCard t={t} missionId={missionId} onReset={() => setStatus('idle')} />
          )}
        </div>
      ) : (
        <TemplateConfigurator
          t={t}
          templates={templates}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={(tmpl) => {
            setSelectedTemplate(tmpl);
            setTopic(tmpl.defaultTopic[locale]);
          }}
          topic={topic}
          onChangeTopic={setTopic}
          costEstimate={costEstimate}
          onLaunch={handleLaunch}
          locale={locale}
        />
      )}
    </div>
  );
}
