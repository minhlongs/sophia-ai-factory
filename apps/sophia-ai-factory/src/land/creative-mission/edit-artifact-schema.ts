/**
 * Validation schema and TypeScript interfaces for creative artifact editing.
 * Layer: land (business domain workflow)
 *
 * Separated from edit-artifact-action.ts to comply with Next.js App Router rules
 * ('use server' files can only export async functions, not objects or values).
 *
 * @module land/creative-mission/edit-artifact-schema
 */

import { z } from 'zod';

export const editCreativeArtifactSchema = z.object({
  workspaceId: z.string().min(1),
  missionId: z.string().min(1),
  assetId: z.string().min(1),
  graphRunId: z.string().default('manual-run'),
  nodeId: z.string().default('human-editor'),
  agentSlug: z.string().default('human-approval'),
  editCount: z.number().int().min(1).default(1),
  changes: z.record(z.string(), z.unknown()),
  reason: z.string().max(500).optional(),
});

export type EditCreativeArtifactInput = z.infer<typeof editCreativeArtifactSchema>;

export interface EditCreativeArtifactResult {
  assetId: string;
  version: number;
  updated: boolean;
}

export interface EditArtifactError {
  code: string;
  message: string;
}
