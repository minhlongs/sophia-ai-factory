/**
 * SOP repository — typed CRUD for the Solo SOPs Platform tables.
 *
 * Covers:
 *  - sop_templates       — library of published SOP playbooks
 *  - user_sop_installations — which SOPs a user has installed
 *  - sop_executions      — individual run state machine
 *
 * All writes use crypto.randomUUID() for IDs and Date.now() for timestamps
 * (epoch ms stored as INTEGER in D1, matching the schema convention).
 *
 * @module seed/db/repositories/sop-repo
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  SopTemplateDbRow,
  UserSopInstallationDbRow,
  SopExecutionDbRow,
} from '@/seed/db/types';

// ── Template CRUD ────────────────────────────────────────────────────────────

/**
 * Fetch SOP templates with optional category / status filters.
 * Returns published templates by default when no status filter is provided.
 */
export async function getSopTemplates(
  filters?: { category?: string; status?: string },
): Promise<SopTemplateDbRow[]> {
  try {
    const db = await getD1Raw();

    const conditions: string[] = [];
    const bindings: unknown[] = [];
    let paramIdx = 1;

    if (filters?.category) {
      conditions.push(`category = ?${paramIdx++}`);
      bindings.push(filters.category);
    }

    const statusFilter = filters?.status ?? 'published';
    conditions.push(`status = ?${paramIdx++}`);
    bindings.push(statusFilter);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, slug, name_vi, name_en, description_vi, description_en,
             category, difficulty, estimated_revenue_min, estimated_revenue_max,
             setup_time_minutes, credits_per_run, version, steps_json,
             input_schema, output_schema, is_featured, is_official, status,
             author_user_id, created_at, updated_at
      FROM sop_templates
      ${where}
      ORDER BY is_featured DESC, created_at DESC
    `;

    const stmt = db.prepare(sql);
    // D1 does not support .bind() with spread on a prepared statement when there
    // are no params — use conditional binding.
    const result = bindings.length > 0
      ? await stmt.bind(...bindings).all<SopTemplateDbRow>()
      : await stmt.all<SopTemplateDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopRepo] getSopTemplates failed', { filters, error: getErrorMessage(err) });
    return [];
  }
}

/**
 * Fetch a single SOP template by its slug.
 * Returns null when not found or on error.
 */
export async function getSopTemplateBySlug(slug: string): Promise<SopTemplateDbRow | null> {
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(
        `SELECT id, slug, name_vi, name_en, description_vi, description_en,
                category, difficulty, estimated_revenue_min, estimated_revenue_max,
                setup_time_minutes, credits_per_run, version, steps_json,
                input_schema, output_schema, is_featured, is_official, status,
                author_user_id, created_at, updated_at
         FROM sop_templates
         WHERE slug = ?1
         LIMIT 1`,
      )
      .bind(slug)
      .first<SopTemplateDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getSopTemplateBySlug failed', { slug, error: getErrorMessage(err) });
    return null;
  }
}

/**
 * Fetch a single SOP template by ID.
 * Returns null when not found or on error.
 */
export async function getSopTemplateById(id: string): Promise<SopTemplateDbRow | null> {
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(
        `SELECT id, slug, name_vi, name_en, description_vi, description_en,
                category, difficulty, estimated_revenue_min, estimated_revenue_max,
                setup_time_minutes, credits_per_run, version, steps_json,
                input_schema, output_schema, is_featured, is_official, status,
                author_user_id, created_at, updated_at
         FROM sop_templates
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(id)
      .first<SopTemplateDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getSopTemplateById failed', { id, error: getErrorMessage(err) });
    return null;
  }
}

/**
 * Insert a new SOP template row.
 * created_at and updated_at are set automatically to Date.now().
 * Throws on D1 constraint violation (e.g. duplicate slug).
 */
export async function insertSopTemplate(
  template: Omit<SopTemplateDbRow, 'created_at' | 'updated_at'>,
): Promise<void> {
  const db = await getD1Raw();
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

// ── Installation CRUD ────────────────────────────────────────────────────────

/**
 * List all SOPs installed by a user within a given org.
 * Returns empty array on error.
 */
export async function getUserInstallations(
  userId: string,
  orgId: string,
): Promise<UserSopInstallationDbRow[]> {
  try {
    const db = await getD1Raw();
    const result = await db
      .prepare(
        `SELECT id, user_id, org_id, sop_template_id, config_overrides,
                custom_name, notes, total_runs, total_credits_spent,
                installed_at, last_run_at
         FROM user_sop_installations
         WHERE user_id = ?1 AND org_id = ?2
         ORDER BY installed_at DESC`,
      )
      .bind(userId, orgId)
      .all<UserSopInstallationDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopRepo] getUserInstallations failed', { userId, orgId, error: getErrorMessage(err) });
    return [];
  }
}

/**
 * Install a SOP template for a user.
 * Returns the new installation ID.
 * Throws on constraint violation.
 */
export async function installSop(
  userId: string,
  orgId: string,
  sopTemplateId: string,
): Promise<string> {
  const db = await getD1Raw();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO user_sop_installations
         (id, user_id, org_id, sop_template_id, total_runs,
          total_credits_spent, installed_at)
       VALUES (?1, ?2, ?3, ?4, 0, 0, ?5)`,
    )
    .bind(id, userId, orgId, sopTemplateId, now)
    .run();

  logger.info('[SopRepo] SOP installed', { id, userId, orgId, sopTemplateId });
  return id;
}

/**
 * Remove a SOP installation by ID.
 * Throws on D1 error; no-op if row does not exist.
 */
export async function uninstallSop(installationId: string): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare(`DELETE FROM user_sop_installations WHERE id = ?1`)
    .bind(installationId)
    .run();

  logger.info('[SopRepo] SOP uninstalled', { installationId });
}

// ── Execution CRUD ───────────────────────────────────────────────────────────

/**
 * Create a new SOP execution row in 'pending' status.
 * Returns the new execution ID.
 */
export async function createExecution(params: {
  userId: string;
  orgId: string;
  sopTemplateId: string;
  installationId?: string;
  inputJson: string;
  totalSteps: number;
}): Promise<string> {
  const db = await getD1Raw();
  const id = crypto.randomUUID();
  const now = Date.now();

  // Initialize step_results as an empty JSON array.
  const emptyStepResults = '[]';

  await db
    .prepare(
      `INSERT INTO sop_executions
         (id, user_id, org_id, sop_template_id, installation_id,
          status, input_json, output_json, error_message,
          current_step, total_steps, step_results, credits_used,
          started_at, completed_at)
       VALUES
         (?1, ?2, ?3, ?4, ?5,
          'pending', ?6, NULL, NULL,
          0, ?7, ?8, 0,
          ?9, NULL)`,
    )
    .bind(
      id,
      params.userId,
      params.orgId,
      params.sopTemplateId,
      params.installationId ?? null,
      params.inputJson,
      params.totalSteps,
      emptyStepResults,
      now,
    )
    .run();

  logger.info('[SopRepo] Execution created', { id, sopTemplateId: params.sopTemplateId });
  return id;
}

/**
 * Fetch a single execution row by ID.
 * Returns null when not found or on error.
 */
export async function getExecution(executionId: string): Promise<SopExecutionDbRow | null> {
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(
        `SELECT id, user_id, org_id, sop_template_id, installation_id,
                status, input_json, output_json, error_message,
                current_step, total_steps, step_results, credits_used,
                started_at, completed_at
         FROM sop_executions
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(executionId)
      .first<SopExecutionDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getExecution failed', { executionId, error: getErrorMessage(err) });
    return null;
  }
}

/**
 * Update the current step and step results of a running execution.
 * Optionally transitions status (defaults to 'running' if not provided).
 */
export async function updateExecutionStep(
  executionId: string,
  currentStep: number,
  stepResults: string,
  status?: string,
): Promise<void> {
  const db = await getD1Raw();
  const resolvedStatus = status ?? 'running';

  await db
    .prepare(
      `UPDATE sop_executions
       SET current_step = ?2,
           step_results = ?3,
           status = ?4
       WHERE id = ?1`,
    )
    .bind(executionId, currentStep, stepResults, resolvedStatus)
    .run();
}

/**
 * Mark an execution as completed.
 * Sets output_json, credits_used, status='completed', and completed_at.
 */
export async function completeExecution(
  executionId: string,
  outputJson: string,
  creditsUsed: number,
): Promise<void> {
  const db = await getD1Raw();
  const now = Date.now();

  await db
    .prepare(
      `UPDATE sop_executions
       SET status = 'completed',
           output_json = ?2,
           credits_used = ?3,
           completed_at = ?4,
           error_message = NULL
       WHERE id = ?1`,
    )
    .bind(executionId, outputJson, creditsUsed, now)
    .run();

  logger.info('[SopRepo] Execution completed', { executionId, creditsUsed });
}

/**
 * Mark an execution as failed with an error message.
 * Sets status='failed' and records the error.
 */
export async function failExecution(
  executionId: string,
  errorMessage: string,
): Promise<void> {
  const db = await getD1Raw();
  const now = Date.now();

  await db
    .prepare(
      `UPDATE sop_executions
       SET status = 'failed',
           error_message = ?2,
           completed_at = ?3
       WHERE id = ?1`,
    )
    .bind(executionId, errorMessage, now)
    .run();

  logger.warn('[SopRepo] Execution failed', { executionId, errorMessage });
}

/**
 * List recent executions for a user, newest first.
 * Defaults to 20 results. Returns empty array on error.
 */
export async function getUserExecutions(
  userId: string,
  limit = 20,
): Promise<SopExecutionDbRow[]> {
  try {
    const db = await getD1Raw();
    const result = await db
      .prepare(
        `SELECT id, user_id, org_id, sop_template_id, installation_id,
                status, input_json, output_json, error_message,
                current_step, total_steps, step_results, credits_used,
                started_at, completed_at
         FROM sop_executions
         WHERE user_id = ?1
         ORDER BY started_at DESC
         LIMIT ?2`,
      )
      .bind(userId, limit)
      .all<SopExecutionDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopRepo] getUserExecutions failed', { userId, error: getErrorMessage(err) });
    return [];
  }
}
