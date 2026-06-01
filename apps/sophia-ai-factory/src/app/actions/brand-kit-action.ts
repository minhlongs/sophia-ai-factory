'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getBrandKit,
  upsertBrandKit,
  deleteBrandKitAsset,
} from '@/seed/db/repositories/brand-kits-repo';
import { getVideoBucket } from '@/land/video/r2-binding';
import { getErrorMessage } from '@/seed/utils/to-error';

type BrandKitResult =
  | { success: true; data: Awaited<ReturnType<typeof getBrandKit>> }
  | { success: false; error: string };

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

interface SaveBrandKitInput {
  primaryColor?: string;
  secondaryColor?: string;
  logoPosition?: string;
  logoOpacity?: number;
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

const ALLOWED_ASSET_TYPES = ['logo', 'intro', 'outro', 'font'] as const;
type AssetType = (typeof ALLOWED_ASSET_TYPES)[number];

const ASSET_LIMITS: Record<AssetType, { maxBytes: number; mimePrefix: string }> = {
  logo: { maxBytes: 2 * 1024 * 1024, mimePrefix: 'image/' },
  intro: { maxBytes: 20 * 1024 * 1024, mimePrefix: 'video/' },
  outro: { maxBytes: 20 * 1024 * 1024, mimePrefix: 'video/' },
  font: { maxBytes: 5 * 1024 * 1024, mimePrefix: 'font/' },
};

export async function uploadBrandAssetAction(
  formData: FormData,
): Promise<BrandKitResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const file = formData.get('file') as File | null;
  const assetType = formData.get('assetType') as string | null;

  if (!file || !assetType) {
    return { success: false, error: 'Missing file or asset type' };
  }

  if (!ALLOWED_ASSET_TYPES.includes(assetType as AssetType)) {
    return { success: false, error: 'Invalid asset type' };
  }

  const type = assetType as AssetType;
  const limits = ASSET_LIMITS[type];

  if (file.size > limits.maxBytes) {
    return { success: false, error: `File too large (max ${limits.maxBytes / 1024 / 1024}MB)` };
  }

  if (type === 'font') {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
      return { success: false, error: 'Invalid font file — use .ttf, .otf, .woff, or .woff2' };
    }
  } else if (!file.type.startsWith(limits.mimePrefix)) {
    return { success: false, error: `Invalid file type for ${type}` };
  }

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

  try {
    const r2Key = `brand-kits/${user.id}/${type}-${Date.now()}.${file.name.split('.').pop()}`;
    const ref = await getVideoBucket();

    if (ref) {
      // Delete old R2 object to prevent orphaned storage
      const existing = await getBrandKit(user.id);
      const oldKey = existing?.[dbFieldMap[type]] as string | null;
      if (oldKey) {
        await ref.bucket.delete(oldKey);
      }

      const buffer = await file.arrayBuffer();
      await ref.bucket.put(r2Key, buffer, {
        httpMetadata: { contentType: file.type },
      });
    }

    const kit = await upsertBrandKit({
      userId: user.id,
      [r2KeyFieldMap[type]]: r2Key,
    });

    return { success: true, data: kit };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function removeBrandAssetAction(
  assetType: string,
): Promise<BrandKitResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  if (!ALLOWED_ASSET_TYPES.includes(assetType as AssetType)) {
    return { success: false, error: 'Invalid asset type' };
  }

  const fieldMap: Record<AssetType, 'logo_r2_key' | 'intro_r2_key' | 'outro_r2_key' | 'font_r2_key'> = {
    logo: 'logo_r2_key',
    intro: 'intro_r2_key',
    outro: 'outro_r2_key',
    font: 'font_r2_key',
  };

  try {
    // Delete old R2 object before nullifying DB reference
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
