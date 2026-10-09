'use client';

/**
 * White-Label Client Portal Overview Tab
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-overview-tab
 */

import React from 'react';
import type { VideoDeliverable, VideoAspectRatio } from './portal-types';
import { PortalVideoRequestForm } from './portal-video-request-form';
import { PortalDeliverablesList } from './portal-deliverables-list';

export interface PortalOverviewTabProps {
  isVi: boolean;
  deliverables: VideoDeliverable[];
  promptInput: string;
  setPromptInput: (val: string) => void;
  selectedRatio: VideoAspectRatio;
  setSelectedRatio: (ratio: VideoAspectRatio) => void;
  selectedLang: string;
  setSelectedLang: (lang: string) => void;
  isSubmitting: boolean;
  submitSuccess: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PortalOverviewTab({
  isVi,
  deliverables,
  promptInput,
  setPromptInput,
  selectedRatio,
  setSelectedRatio,
  selectedLang,
  setSelectedLang,
  isSubmitting,
  submitSuccess,
  onSubmit,
}: PortalOverviewTabProps) {
  return (
    <div className="space-y-8">
      <PortalVideoRequestForm
        isVi={isVi}
        promptInput={promptInput}
        setPromptInput={setPromptInput}
        selectedRatio={selectedRatio}
        setSelectedRatio={setSelectedRatio}
        selectedLang={selectedLang}
        setSelectedLang={setSelectedLang}
        isSubmitting={isSubmitting}
        submitSuccess={submitSuccess}
        onSubmit={onSubmit}
      />

      <PortalDeliverablesList
        isVi={isVi}
        deliverables={deliverables}
      />
    </div>
  );
}
