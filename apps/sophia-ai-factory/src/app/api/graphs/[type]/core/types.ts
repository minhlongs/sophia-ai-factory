import { z } from 'zod';
import type { NextResponse } from 'next/server';

export const ipLineageParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  ipId: z.string().min(1, 'IP ID is required'),
});

export const contentLineageParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
});

export const listProjectsParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  missionId: z.string().optional(),
});

export const ipListParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

export type IpLineageParams = z.infer<typeof ipLineageParamsSchema>;
export type ContentLineageParams = z.infer<typeof contentLineageParamsSchema>;
export type ListProjectsParams = z.infer<typeof listProjectsParamsSchema>;
export type IpListParams = z.infer<typeof ipListParamsSchema>;

export type AuthGate<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };
