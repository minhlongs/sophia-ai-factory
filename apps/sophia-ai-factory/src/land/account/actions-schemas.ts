import { z } from 'zod';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['EDITOR', 'VIEWER']),
});

export const updateRoleSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(['EDITOR', 'VIEWER']),
});

export const removeMemberSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .transform((val) => val.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim())
    .refine((val) => val.length >= 1, {
      message: 'Name cannot be empty',
    })
    .refine((val) => val.length <= 100, {
      message: 'Name cannot exceed 100 characters',
    })
    .refine((val) => !/<[^>]*>|[<>]/.test(val), {
      message: 'Name cannot contain HTML or script characters',
    }),
});

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

export async function persistUserProfileName(
  userId: string,
  parsedName: string,
): Promise<UpdateProfileResult> {
  try {
    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'Database unavailable' };
    }

    await d1
      .prepare('UPDATE "user" SET name = ?, updatedAt = datetime(\'now\') WHERE id = ?')
      .bind(parsedName, userId)
      .run();

    try {
      await d1
        .prepare('UPDATE users SET full_name = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .bind(parsedName, userId)
        .run();
    } catch {
      // Ignore if legacy users record absent
    }

    return { success: true };
  } catch (err) {
    logger.error(
      '[AccountActions] updateUserProfileAction failed',
      err instanceof Error ? err : new Error(String(err)),
    );
    return { success: false, error: 'Failed to update profile' };
  }
}
