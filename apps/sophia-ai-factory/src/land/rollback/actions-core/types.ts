import { z } from 'zod';

export type RollbackActionError =
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_AUTHENTICATED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string }
  | { code: 'INTERNAL'; message: string };

export const RollbackMissionSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
