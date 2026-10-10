import { z } from 'zod';

export const ScheduleWhatsAppSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  templateId: z.number().int().positive('templateId must be a positive integer'),
  target: z.string().regex(/^\+?\d{10,15}$/, 'target must be a valid E.164 phone number'),
  variables: z.record(z.string(), z.string()).optional(),
});

export type ScheduleWhatsAppInput = z.infer<typeof ScheduleWhatsAppSchema>;

export const ApproveWhatsAppSchema = z.object({
  jobId: z.string().optional(), // Optional — approval is per-user, not per-job
});

export type ApproveWhatsAppInput = z.infer<typeof ApproveWhatsAppSchema>;

export interface ScheduleWhatsAppResult {
  jobId: string;
  status: 'scheduled' | 'pending_approval';
  error?: string;
}

export interface ApproveWhatsAppResult {
  approved: boolean;
}

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

export interface VideoRow {
  id: string;
  user_id: string;
}

export interface ApprovalRow {
  whatsapp_approved: number;
}

export interface TemplateRow {
  id: number;
}
