/**
 * SOP Seed Entry Interface
 *
 * @module seed/sop/seeds/types
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
