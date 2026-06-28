/**
 * @module sop/seeds
 * Barrel re-exports for SOP seed data.
 * Playbook entries import SopSeedEntry from here.
 */

/** Unified seed entry including new no-code fields */
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
  /** JSON Schema string describing the no-code form fields */
  configSchema?: string;
  /** JSON object string with default form values */
  configDefaults?: string;
  /** Minutes to set up (shown in UI) */
  setupTimeMinutes?: number;
  /** 1 = show in featured section */
  isFeatured?: 0 | 1;
}

// Re-export the type so `import type { SopSeedEntry } from '../../index'` works
