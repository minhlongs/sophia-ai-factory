'use client';

/**
 * SolutionInteractiveSectionsView — orchestrator view for all solution interactive sections
 *
 * Layer: forest/solutions/interactive-sections
 */

import React from 'react';
import type { SolutionInteractiveSectionsProps } from './types';
import { SamplePromptRunner } from './sample-prompt-runner';
import { RoiCalculator } from './roi-calculator';
import { FaqAccordion } from './faq-accordion';
import { PromoCtaSection } from './promo-cta-section';

export function SolutionInteractiveSectionsView({
  industry,
  locale,
}: SolutionInteractiveSectionsProps) {
  const isVi = locale === 'vi';

  return (
    <div className="w-full space-y-16">
      <SamplePromptRunner industry={industry} isVi={isVi} />
      <RoiCalculator industry={industry} isVi={isVi} />
      <FaqAccordion industry={industry} isVi={isVi} />
      <PromoCtaSection industry={industry} isVi={isVi} />
    </div>
  );
}
