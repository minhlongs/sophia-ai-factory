/**
 * CEO Solo Media workflow preset steps ($1M MRR parallel execution).
 *
 * @module seed/config/ceo-solo-media-preset-steps
 */

import type { WorkflowStep } from './supervisor-step-types';

export const CEO_SOLO_MEDIA_STEPS: WorkflowStep[] = [
  // Phase 1: Research (parallel)
  {
    order: 1,
    type: 'market_research',
    command: 'solo.ceo.market_research',
    parallelGroup: 1,
    label: {
      en: 'Market Research & Competitive Analysis',
      vi: 'Nghien cuu thi truong & phan tich doi thu',
    },
  },
  {
    order: 2,
    type: 'audience_analysis',
    command: 'solo.analyst.audience',
    parallelGroup: 1,
    label: {
      en: 'Audience Segmentation & Persona Building',
      vi: 'Phan khuc khan gia & xay dung persona',
    },
  },
  // Phase 2: Strategy (depends on Phase 1)
  {
    order: 3,
    type: 'content_strategy',
    command: 'solo.marketer.content_strategy',
    parallelGroup: 2,
    dependsOn: [1, 2],
    label: {
      en: 'Content Strategy & Pillar Planning',
      vi: 'Chien luoc noi dung & ke hoach tru cot',
    },
  },
  {
    order: 4,
    type: 'monetization_blueprint',
    command: 'solo.ceo.monetization',
    dependsOn: [1, 2],
    parallelGroup: 2,
    label: {
      en: 'Monetization Blueprint — Revenue Streams',
      vi: 'Ke hoach kiem tien — kenh doanh thu',
    },
  },
  // Phase 3: Production & Distribution (parallel, depends on Phase 2)
  {
    order: 5,
    type: 'content_production',
    command: 'solo.marketer.production',
    dependsOn: [3, 4],
    parallelGroup: 3,
    label: {
      en: 'Content Production Pipeline',
      vi: 'Quy trinh san xuat noi dung',
    },
  },
  {
    order: 6,
    type: 'distribution_setup',
    command: 'solo.ops.distribution',
    dependsOn: [3, 4],
    parallelGroup: 3,
    label: {
      en: 'Multi-Channel Distribution Setup',
      vi: 'Thiet lap phan phoi da kenh',
    },
  },
  // Phase 4: Analytics & Optimization (final)
  {
    order: 7,
    type: 'analytics_dashboard',
    command: 'solo.analyst.dashboard',
    dependsOn: [5, 6],
    label: {
      en: 'Analytics Dashboard & MRR Tracking',
      vi: 'Bang phan tich & theo doi MRR',
    },
  },
  {
    order: 8,
    type: 'optimization_loop',
    command: 'solo.ceo.optimize',
    dependsOn: [7],
    label: {
      en: 'Continuous Optimization Loop',
      vi: 'Vong toi uu hoa lien tuc',
    },
  },
];
