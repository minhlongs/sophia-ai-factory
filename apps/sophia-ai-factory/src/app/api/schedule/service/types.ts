import { z } from 'zod';

export interface ScheduledCampaignRow {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number | null;
  next_run_date: string;
  is_active: number;
}

export const scheduleDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value),
    'Expected YYYY-MM-DD or ISO datetime',
  )
  .transform((value) => value.slice(0, 10))
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');

export const scheduleCreateSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  template_script: z.string().max(20000).nullable().optional(),
  interval_days: z.number().int().min(1).max(365).optional().default(7),
  next_run_date: scheduleDateSchema,
});

export const schedulePatchSchema = z.object({
  id: z.string().trim().min(1).max(128),
  is_active: z.boolean().optional(),
  interval_days: z.number().int().min(1).max(365).optional(),
  next_run_date: scheduleDateSchema.optional(),
  topic: z.string().trim().min(1).max(200).optional(),
}).refine(
  (value) =>
    value.is_active !== undefined ||
    value.interval_days !== undefined ||
    value.next_run_date !== undefined ||
    value.topic !== undefined,
  'No fields to update',
);

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type SchedulePatchInput = z.infer<typeof schedulePatchSchema>;
