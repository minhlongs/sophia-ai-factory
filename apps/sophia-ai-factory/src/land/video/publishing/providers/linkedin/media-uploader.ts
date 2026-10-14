import { LI_API, RegisterUploadResponse } from './types';

export async function uploadVideoBinary(
  videoUrl: string,
  accessToken: string,
  authorUrn: string
): Promise<{ assetUrn: string }> {
  // Step 1: Fetch video binary
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`[LinkedInPublisher] Failed to fetch video: ${videoRes.status}`);
  }
  const videoBlob = await videoRes.blob();

  // Step 2: Register upload to get asset URN + upload URL
  const registerRes = await fetch(`${LI_API}/v2/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
        owner: authorUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  if (!registerRes.ok) {
    const text = await registerRes.text();
    throw new Error(`[LinkedInPublisher] Register upload failed (${registerRes.status}): ${text}`);
  }

  const registerData = (await registerRes.json()) as RegisterUploadResponse;
  const uploadUrl =
    registerData.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
  const assetUrn = registerData.value.asset;

  // Step 3: Upload video binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: videoBlob,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`[LinkedInPublisher] Video upload failed (${uploadRes.status}): ${text}`);
  }

  return { assetUrn };
}
