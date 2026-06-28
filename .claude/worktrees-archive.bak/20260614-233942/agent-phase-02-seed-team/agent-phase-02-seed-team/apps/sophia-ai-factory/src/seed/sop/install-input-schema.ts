/**
 * Install Input Schema — Zod validation for SOP installation requests.
 *
 * Used by both Server Action (installSopAction) and API route (POST /api/sop/install).
 * Cron schedule restricted to 4 whitelisted presets in Phase 1 to prevent edge cases.
 */

import { z } from 'zod';

/** Whitelisted cron schedule presets */
export const CRON_PRESETS = {
  hourly: '0 * * * *',
  daily9am: '0 9 * * *',
  weeklyMon9am: '0 9 * * 1',
  manual: null,
} as const;

export type CronPresetKey = keyof typeof CRON_PRESETS;

/** Maps cron string back to preset key for display */
export const CRON_PRESET_VALUES = Object.values(CRON_PRESETS).filter(Boolean) as string[];

export const installInputSchema = z.object({
  slug: z.string().min(1).max(120),
  /** One of 4 preset cron strings, or null/undefined for manual-only */
  scheduleCron: z
    .string()
    .refine(
      (v) => CRON_PRESET_VALUES.includes(v),
      { message: 'Schedule must be one of the 4 preset values' },
    )
    .nullable()
    .optional(),
  enabled: z.boolean().default(true),
});

export type InstallInput = z.infer<typeof installInputSchema>;

/** Customization schema for PATCH /api/sop/installations/[id]/customizations */
export const customizationInputSchema = z.object({
  playbookMdOverride: z.string().max(32 * 1024).optional(),
  vars: z.record(z.string(), z.unknown()).optional(),
});

export type CustomizationInput = z.infer<typeof customizationInputSchema>;
