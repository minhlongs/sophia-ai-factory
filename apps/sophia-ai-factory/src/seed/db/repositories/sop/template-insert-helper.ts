/**
 * SOP Template insertion helper
 *
 * @module seed/db/repositories/sop/template-insert-helper
 */

import { getD1 } from '@/seed/db/client';
import type { SopTemplateDbRow } from '@/seed/db/types';

export const SOP_TEMPLATE_COLUMNS = `
  id, slug, name_vi, name_en, description_vi, description_en,
  category, difficulty, estimated_revenue_min, estimated_revenue_max,
  setup_time_minutes, credits_per_run, version, steps_json,
  input_schema, output_schema, is_featured, is_official, status,
  author_user_id, created_at, updated_at
`;

/**
 * Insert a new SOP template row.
 * created_at and updated_at are set automatically to Date.now().
 * Throws on D1 constraint violation (e.g. duplicate slug).
 */
export async function insertSopTemplate(
  template: Omit<SopTemplateDbRow, 'created_at' | 'updated_at'>,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO sop_templates
         (id, slug, name_vi, name_en, description_vi, description_en,
          category, difficulty, estimated_revenue_min, estimated_revenue_max,
          setup_time_minutes, credits_per_run, version, steps_json,
          input_schema, output_schema, is_featured, is_official, status,
          author_user_id, created_at, updated_at)
       VALUES
         (?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10,
          ?11, ?12, ?13, ?14,
          ?15, ?16, ?17, ?18, ?19,
          ?20, ?21, ?21)`,
    )
    .bind(
      template.id,
      template.slug,
      template.name_vi,
      template.name_en,
      template.description_vi ?? null,
      template.description_en ?? null,
      template.category,
      template.difficulty,
      template.estimated_revenue_min ?? null,
      template.estimated_revenue_max ?? null,
      template.setup_time_minutes,
      template.credits_per_run,
      template.version,
      template.steps_json,
      template.input_schema,
      template.output_schema,
      template.is_featured,
      template.is_official,
      template.status,
      template.author_user_id ?? null,
      now,
    )
    .run();
}
