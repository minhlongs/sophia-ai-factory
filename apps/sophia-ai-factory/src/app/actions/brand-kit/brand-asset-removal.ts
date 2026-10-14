'use server';

/**
 * Brand asset removal action with R2 object cleanup
 *
 * @module app/actions/brand-kit/brand-asset-removal
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getBrandKit,
  deleteBrandKitAsset,
} from '@/seed/db/repositories/brand-kits-repo';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  ALLOWED_ASSET_TYPES,
  type AssetType,
  type BrandKitResult,
} from './types';

const fieldMap: Record<
  AssetType,
  'logo_r2_key' | 'intro_r2_key' | 'outro_r2_key' | 'font_r2_key'
> = {
  logo: 'logo_r2_key',
  intro: 'intro_r2_key',
  outro: 'outro_r2_key',
  font: 'font_r2_key',
};

export async function removeBrandAssetAction(
  assetType: string,
): Promise<BrandKitResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  if (!ALLOWED_ASSET_TYPES.includes(assetType as AssetType)) {
    return { success: false, error: 'Invalid asset type' };
  }

  try {
    const existing = await getBrandKit(user.id);
    const oldKey = existing?.[fieldMap[assetType as AssetType]] as string | null;
    if (oldKey) {
      const ref = await getVideoBucket();
      if (ref) await ref.bucket.delete(oldKey);
    }

    await deleteBrandKitAsset(user.id, fieldMap[assetType as AssetType]);
    const kit = await getBrandKit(user.id);
    return { success: true, data: kit };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
