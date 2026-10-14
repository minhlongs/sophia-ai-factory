'use server';

/**
 * Get and save actions for brand kit preferences
 *
 * @module app/actions/brand-kit/brand-kit-crud
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getBrandKit,
  upsertBrandKit,
} from '@/seed/db/repositories/brand-kits-repo';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { BrandKitResult, SaveBrandKitInput } from './types';

export async function getBrandKitAction(): Promise<BrandKitResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const kit = await getBrandKit(user.id);
    return { success: true, data: kit };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function saveBrandKitAction(
  input: SaveBrandKitInput,
): Promise<BrandKitResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const kit = await upsertBrandKit({
      userId: user.id,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      logoPosition: input.logoPosition,
      logoOpacity: input.logoOpacity,
    });
    return { success: true, data: kit };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
