'use server';

/**
 * Server Actions for WhatsApp Publishing
 *
 * Provides type-safe server-side mutations for:
 * - Scheduling WhatsApp publishes with template selection
 * - Approving first-time WhatsApp sends (approval gate)
 *
 * Uses Result<T,E> pattern for error handling, Zod validation,
 * and getCurrentUser() for auth — following Sophia conventions.
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';

// ─── Zod Schemas ────────────────────────────────────────────────────────────────

const ScheduleWhatsAppSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  templateId: z.number().int().positive('templateId must be a positive integer'),
  target: z.string().regex(/^\+?\d{10,15}$/, 'target must be a valid E.164 phone number'),
  variables: z.record(z.string(), z.string()).optional(),
});

export type ScheduleWhatsAppInput = z.infer<typeof ScheduleWhatsAppSchema>;

const ApproveWhatsAppSchema = z.object({
  jobId: z.string().optional(), // Optional — approval is per-user, not per-job
});

export type ApproveWhatsAppInput = z.infer<typeof ApproveWhatsAppSchema>;

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ScheduleWhatsAppResult {
  jobId: string;
  status: 'scheduled' | 'pending_approval';
  error?: string;
}

export interface ApproveWhatsAppResult {
  approved: boolean;
}

// ─── Error Codes ────────────────────────────────────────────────────────────────

export type ScheduleErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'VIDEO_NOT_FOUND'
  | 'FORBIDDEN'
  | 'NOT_APPROVED'
  | 'NO_WHATSAPP_CREDENTIALS'
  | 'INSERT_FAILED'
  | 'D1_UNAVAILABLE';

export type ApproveErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'NO_WHATSAPP_CREDENTIALS'
  | 'ALREADY_APPROVED'
  | 'UPDATE_FAILED'
  | 'D1_UNAVAILABLE';

export class ScheduleWhatsAppError extends Error {
  code: ScheduleErrorCode;
  constructor(code: ScheduleErrorCode, message: string) {
    super(message);
    this.name = 'ScheduleWhatsAppError';
    this.code = code;
  }
}

export class ApproveWhatsAppError extends Error {
  code: ApproveErrorCode;
  constructor(code: ApproveErrorCode, message: string) {
    super(message);
    this.name = 'ApproveWhatsAppError';
    this.code = code;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function newJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface VideoRow {
  id: string;
  user_id: string;
}

interface ApprovalRow {
  whatsapp_approved: number;
}

interface TemplateRow {
  id: number;
}

// ─── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Check if the user has approved WhatsApp outbound sends.
 * Queries the whatsapp_approved flag on their whatsapp_templates row.
 */
async function checkApprovalStatus(userId: string): Promise<Result<boolean>> {
  const db = await getD1();
  if (!db) return failure(new ScheduleWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  const row = await db
    .prepare(
      `SELECT whatsapp_approved FROM whatsapp_templates
       WHERE user_id = ?1 ORDER BY is_default DESC LIMIT 1`,
    )
    .bind(userId)
    .first<ApprovalRow>();

  if (!row) return success(false);
  return success(row.whatsapp_approved === 1);
}

/**
 * Mark the user as having approved WhatsApp outbound sends.
 * Updates all whatsapp_templates rows for the user.
 */
async function setApprovalStatus(userId: string): Promise<Result<void>> {
  const db = await getD1();
  if (!db) return failure(new ApproveWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  const result = await db
    .prepare(
      `UPDATE whatsapp_templates SET whatsapp_approved = 1
       WHERE user_id = ?1`,
    )
    .bind(userId)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return failure(
      new ApproveWhatsAppError(
        'NO_WHATSAPP_CREDENTIALS',
        'No WhatsApp credentials found for this user',
      ),
    );
  }

  logger.info('[WhatsAppPublish] User approved WhatsApp sends', { userId });
  return success(undefined);
}

/**
 * Server Action: Schedule a WhatsApp publish job.
 *
 * Flow:
 * 1. Validate input (Zod)
 * 2. Verify user is authenticated
 * 3. Verify video ownership
 * 4. Check approval gate (first publish requires explicit approval)
 * 5. Verify WhatsApp credentials exist for template
 * 6. Insert publishing_jobs row
 *
 * Returns Result — callers never need try/catch.
 */
export async function scheduleWhatsApp(
  input: ScheduleWhatsAppInput,
): Promise<Result<ScheduleWhatsAppResult>> {
  // 1. Validate input
  const parsed = ScheduleWhatsAppSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      new ScheduleWhatsAppError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input'),
    );
  }
  const { videoId, templateId, target, variables: _variables } = parsed.data;

  // 2. Auth
  const user = await getCurrentUser();
  if (!user) {
    return failure(new ScheduleWhatsAppError('UNAUTHENTICATED', 'Authentication required'));
  }

  const db = await getD1();
  if (!db) return failure(new ScheduleWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  // 3. Verify video ownership
  const video = await db
    .prepare('SELECT id, user_id FROM videos WHERE id = ?1 LIMIT 1')
    .bind(videoId)
    .first<VideoRow>();
  if (!video) {
    return failure(new ScheduleWhatsAppError('VIDEO_NOT_FOUND', `video ${videoId} not found`));
  }
  if (video.user_id !== user.id) {
    return failure(new ScheduleWhatsAppError('FORBIDDEN', 'video belongs to a different user'));
  }

  // 4. Approval gate
  const approval = await checkApprovalStatus(user.id);
  if (!approval.ok) return failure(approval.error);
  if (!approval.value) {
    return success({
      jobId: '',
      status: 'pending_approval',
      error: 'User must approve WhatsApp sends before first publish',
    });
  }

  // 5. Verify WhatsApp credentials exist for template
  const cred = await db
    .prepare(
      `SELECT id FROM whatsapp_templates
       WHERE id = ?1 AND user_id = ?2 LIMIT 1`,
    )
    .bind(templateId, user.id)
    .first<TemplateRow>();
  if (!cred) {
    return failure(
      new ScheduleWhatsAppError(
        'NO_WHATSAPP_CREDENTIALS',
        'WhatsApp credential not found for this user',
      ),
    );
  }

  // 6. Insert publishing_jobs
  const jobId = newJobId();
  const now = Math.floor(Date.now() / 1000);
  const recipient = `wa:${target.replace(/^\+/, '')}`;

  try {
    await db
      .prepare(
        `INSERT INTO publishing_jobs (
           id, tenant_id, video_id, channel_id, provider, status,
           caption, hashtags_json, product_link, scheduled_at,
           retry_count, created_at
         ) VALUES (?, ?, ?, ?, 'whatsapp', 'scheduled', ?, NULL, NULL, ?, 0, ?)`,
      )
      .bind(jobId, user.id, videoId, recipient, templateId, now, now)
      .run();
  } catch (err) {
    const error = toError(err);
    logger.error('[WhatsAppPublish] D1 insert failed', error, {
      userId: user.id,
      videoId,
      templateId,
    });
    return failure(new ScheduleWhatsAppError('INSERT_FAILED', error.message));
  }

  logger.info('[WhatsAppPublish] Job scheduled', {
    jobId,
    userId: user.id,
    videoId,
    templateId,
    target,
  });

  return success({ jobId, status: 'scheduled' });
}

/**
 * Server Action: Approve WhatsApp outbound sends for the current user.
 *
 * This is a one-time action that marks the user as having explicitly
 * approved WhatsApp publishing. After approval, all future publishes
 * will proceed without the approval gate.
 *
 * Returns Result — callers never need try/catch.
 */
export async function approveWhatsApp(
  _input: ApproveWhatsAppInput = {},
): Promise<Result<ApproveWhatsAppResult>> {
  // Validate input (mostly for future extensibility)
  const parsed = ApproveWhatsAppSchema.safeParse(_input);
  if (!parsed.success) {
    return failure(
      new ApproveWhatsAppError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input'),
    );
  }

  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return failure(new ApproveWhatsAppError('UNAUTHENTICATED', 'Authentication required'));
  }

  const db = await getD1();
  if (!db) return failure(new ApproveWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  // Check if already approved
  const approval = await checkApprovalStatus(user.id);
  if (!approval.ok) return failure(approval.error);
  if (approval.value) {
    return success({ approved: true }); // Idempotent — already approved
  }

  // Set approval
  const result = await setApprovalStatus(user.id);
  if (!result.ok) return failure(result.error);

  return success({ approved: true });
}