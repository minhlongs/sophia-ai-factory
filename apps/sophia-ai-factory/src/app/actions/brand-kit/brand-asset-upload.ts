'use server';

/**
 * Asset upload action with magic-bytes detection and R2 persistence
 *
 * @module app/actions/brand-kit/brand-asset-upload
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getBrandKit, upsertBrandKit } from '@/seed/db/repositories/brand-kits-repo';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { getErrorMessage } from '@/seed/utils/to-error';
import { ALLOWED_ASSET_TYPES, ASSET_LIMITS, type AssetType, type BrandKitResult } from './types';
import { detectMimeType } from './mime-detector';
import { validateAssetFile } from './asset-validator';

const r2KeyFieldMap: Record<AssetType, 'logoR2Key' | 'introR2Key' | 'outroR2Key' | 'fontR2Key'> = {
  logo: 'logoR2Key',
  intro: 'introR2Key',
  outro: 'outroR2Key',
  font: 'fontR2Key',
};

const dbFieldMap: Record<AssetType, keyof NonNullable<Awaited<ReturnType<typeof getBrandKit>>>> = {
  logo: 'logo_r2_key',
  intro: 'intro_r2_key',
  outro: 'outro_r2_key',
  font: 'font_r2_key',
};

export async function uploadBrandAssetAction(formData: FormData): Promise<BrandKitResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const file = formData.get('file') as File | null;
  const assetType = formData.get('assetType') as string | null;
  if (!file || !assetType) return { success: false, error: 'Missing file or asset type' };
  if (!ALLOWED_ASSET_TYPES.includes(assetType as AssetType)) return { success: false, error: 'Invalid asset type' };

  const type = assetType as AssetType;
  const limits = ASSET_LIMITS[type];
  const validationError = validateAssetFile(file, type, limits);
  if (validationError) return { success: false, error: validationError };

  try {
    const buffer = Buffer.from(await file.arrayBuffer()).slice(0, 12);
    const detected = detectMimeType(buffer);
    if (!detected?.startsWith(limits.mimePrefix)) {
      return { success: false, error: `File content does not match ${type} format — possible spoofing` };
    }
  } catch {
    // Non-fatal: skip magic bytes check if file read fails
  }

  try {
    const r2Key = `brand-kits/${user.id}/${type}-${Date.now()}.${file.name.split('.').pop()}`;
    const ref = await getVideoBucket();
    if (ref) {
      const existing = await getBrandKit(user.id);
      const oldKey = existing?.[dbFieldMap[type]] as string | null;
      if (oldKey) await ref.bucket.delete(oldKey);
      const buffer = await file.arrayBuffer();
      await ref.bucket.put(r2Key, buffer, { httpMetadata: { contentType: file.type } });
    }
    const kit = await upsertBrandKit({ userId: user.id, [r2KeyFieldMap[type]]: r2Key });
    return { success: true, data: kit };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
