/**
 * Video Storage Service
 *
 * Downloads temporary HeyGen video URLs and uploads them to Supabase Storage
 * so they remain accessible after HeyGen's CDN links expire.
 *
 * Bucket: 'campaign-videos' (must exist in Supabase Storage)
 * Path:   campaigns/{campaignId}/{timestamp}.mp4
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger-utility";

export interface VideoStorageResult {
  permanentUrl: string;
  bucket: string;
  path: string;
  sizeBytes: number;
}

const BUCKET = "campaign-videos";

async function getStorageClient() {
  return createAdminClient();
}

/**
 * Download a video from a HeyGen temporary URL and upload it to Supabase Storage.
 * If storage upload fails, falls back to returning the original HeyGen URL.
 */
export async function downloadAndStore(
  heygenUrl: string,
  campaignId: string,
): Promise<VideoStorageResult> {
  const storagePath = `campaigns/${campaignId}/${Date.now()}.mp4`;

  try {
    const response = await fetch(heygenUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const sizeBytes = blob.size;

    const supabase = await getStorageClient();
    const storage = (supabase as any).storage;
    if (!storage) {
      throw new Error("Storage not available in D1 client");
    }

    const { error: uploadError } = await storage
      .from(BUCKET)
      .upload(storagePath, blob, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    logger.info("[VideoStorageService] Video stored successfully", {
      campaignId,
      path: storagePath,
      sizeBytes,
    });

    return {
      permanentUrl: publicUrlData.publicUrl,
      bucket: BUCKET,
      path: storagePath,
      sizeBytes,
    };
  } catch (err) {
    logger.error(
      "[VideoStorageService] Failed to store video, falling back to HeyGen URL",
      err instanceof Error ? err : undefined,
      { campaignId, heygenUrl },
    );

    // Graceful fallback: return the original HeyGen URL so the campaign is not blocked
    return {
      permanentUrl: heygenUrl,
      bucket: BUCKET,
      path: storagePath,
      sizeBytes: 0,
    };
  }
}
