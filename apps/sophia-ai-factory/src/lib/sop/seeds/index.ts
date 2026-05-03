/**
 * SOP Seed Registry
 * Aggregates all official starter playbooks for SQL generation + migration.
 */

import * as dailyContentFactory from './daily-content-factory';
import * as reactiveLeadEngine from './reactive-lead-engine';
import * as weeklyPerformanceReport from './weekly-performance-report';
import * as proposalAutoPilot from './proposal-auto-pilot';
import * as crisisPrMode from './crisis-pr-mode';

export interface SopSeedEntry {
  slug: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  category: string;
  creditsPerRun: number;
  agentsYaml: string;
  playbookMd: string;
  outputSchema: string;
}

export const SOP_SEEDS: SopSeedEntry[] = [
  {
    slug: dailyContentFactory.slug,
    nameVi: dailyContentFactory.nameVi,
    nameEn: dailyContentFactory.nameEn,
    descVi: dailyContentFactory.descVi,
    descEn: dailyContentFactory.descEn,
    category: dailyContentFactory.category,
    creditsPerRun: dailyContentFactory.creditsPerRun,
    agentsYaml: dailyContentFactory.agentsYaml,
    playbookMd: dailyContentFactory.playbookMd,
    outputSchema: dailyContentFactory.outputSchema,
  },
  {
    slug: reactiveLeadEngine.slug,
    nameVi: reactiveLeadEngine.nameVi,
    nameEn: reactiveLeadEngine.nameEn,
    descVi: reactiveLeadEngine.descVi,
    descEn: reactiveLeadEngine.descEn,
    category: reactiveLeadEngine.category,
    creditsPerRun: reactiveLeadEngine.creditsPerRun,
    agentsYaml: reactiveLeadEngine.agentsYaml,
    playbookMd: reactiveLeadEngine.playbookMd,
    outputSchema: reactiveLeadEngine.outputSchema,
  },
  {
    slug: weeklyPerformanceReport.slug,
    nameVi: weeklyPerformanceReport.nameVi,
    nameEn: weeklyPerformanceReport.nameEn,
    descVi: weeklyPerformanceReport.descVi,
    descEn: weeklyPerformanceReport.descEn,
    category: weeklyPerformanceReport.category,
    creditsPerRun: weeklyPerformanceReport.creditsPerRun,
    agentsYaml: weeklyPerformanceReport.agentsYaml,
    playbookMd: weeklyPerformanceReport.playbookMd,
    outputSchema: weeklyPerformanceReport.outputSchema,
  },
  {
    slug: proposalAutoPilot.slug,
    nameVi: proposalAutoPilot.nameVi,
    nameEn: proposalAutoPilot.nameEn,
    descVi: proposalAutoPilot.descVi,
    descEn: proposalAutoPilot.descEn,
    category: proposalAutoPilot.category,
    creditsPerRun: proposalAutoPilot.creditsPerRun,
    agentsYaml: proposalAutoPilot.agentsYaml,
    playbookMd: proposalAutoPilot.playbookMd,
    outputSchema: proposalAutoPilot.outputSchema,
  },
  {
    slug: crisisPrMode.slug,
    nameVi: crisisPrMode.nameVi,
    nameEn: crisisPrMode.nameEn,
    descVi: crisisPrMode.descVi,
    descEn: crisisPrMode.descEn,
    category: crisisPrMode.category,
    creditsPerRun: crisisPrMode.creditsPerRun,
    agentsYaml: crisisPrMode.agentsYaml,
    playbookMd: crisisPrMode.playbookMd,
    outputSchema: crisisPrMode.outputSchema,
  },
];
