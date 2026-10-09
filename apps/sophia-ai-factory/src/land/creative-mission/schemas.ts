/**
 * @module land/creative-mission/schemas
 * Zod validation schemas for creative mission server actions.
 *
 * Layer: land — imports seed only.
 */

import { z } from 'zod';

export const createMissionSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  objective: z.string().min(1, 'Objective is required').max(2000, 'Objective too long'),
  audience: z.string().min(1, 'Audience is required').max(1000, 'Audience too long'),
  geography: z.string().min(1, 'Geography is required').max(500, 'Geography too long'),
  timeframeStart: z.number().positive('Start time must be positive'),
  timeframeEnd: z.number().positive('End time must be positive'),
  budgetCents: z.number().min(0, 'Budget must be non-negative'),
  autonomyLevel: z.number().min(0).max(4, 'Autonomy level must be 0-4'),
  channels: z.array(z.string()).default([]),
  monetizationGoals: z.array(z.string()).default([]),
  constraints: z.record(z.string(), z.unknown()).default({}),
  successMetrics: z.record(z.string(), z.number()).default({}),
  brandId: z.string().optional(),
});

export const updateMissionStatusSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  status: z.enum([
    'draft',
    'planned',
    'approval_required',
    'running',
    'paused',
    'review',
    'completed',
    'learning',
    'iterating',
  ]),
});

export const listMissionsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

export const getMissionSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
});

export const startMissionExecutionSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  autonomyLevel: z.number().min(0).max(4, 'Autonomy level must be 0-4').default(0),
  estimatedCostCents: z.number().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
});

export const getMissionTrackStatusSchema = z.union([
  z.string().min(1, 'Mission ID is required'),
  z.object({
    missionId: z.string().min(1, 'Mission ID is required'),
  }),
]);

export const executeMultiTrackMissionSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  topic: z.string().trim().max(500).optional(),
  estimatedScenes: z.number().int().min(1).max(20).optional(),
  durationSeconds: z.number().int().min(15).max(180).optional(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:3']).optional(),
  estimatedCostCents: z.number().int().nonnegative().max(500).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
});

export const requestApprovalSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  runId: z.string().min(1, 'Run ID is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export const resolveApprovalSchema = z.object({
  approvalId: z.string().min(1, 'Approval ID is required'),
  approved: z.boolean(),
  reason: z.string().optional(),
});

export const listPendingApprovalsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  limit: z.number().min(1).max(100).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
});

