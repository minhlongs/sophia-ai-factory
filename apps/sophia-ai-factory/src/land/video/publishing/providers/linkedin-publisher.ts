/**
 * LinkedIn Publisher Adapter
 * Uses LinkedIn Community Management API to publish native video posts.
 * Falls back to mock 200 responses when LINKEDIN_CLIENT_ID is absent.
 *
 * Upload flow (native video, max 5GB / 10 min):
 * 1. POST /v2/assets?action=registerUpload → get upload URL + asset URN
 * 2. PUT video binary to uploadUrl
 * 3. POST /v2/posts with shareMediaCategory=VIDEO → return post URN
 *
 * Wires the daily-linkedin-post.ts and linkedin-outreach.ts SOP playbooks.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const LI_API = 'https://api.linkedin.com';
const MAX_COMMENTARY_LEN = 3000;

function isMockMode(): boolean {
  return !process.env.LINKEDIN_CLIENT_ID;
}

interface RegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
        headers?: Record<string, string>;
      };
    };
    asset: string; // e.g. "urn:li:digitalmediaAsset:..."
  };
}

interface PostCreateResponse {
  id: string; // post URN e.g. "urn:li:ugcPost:..."
}

interface VideoStatsResponse {
  elements?: Array<{
    totalShareStatistics?: {
      impressionCount?: number;
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
    };
  }>;
}

export class LinkedInPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    /** LinkedIn member URN e.g. "urn:li:person:ABC123" */
    private readonly authorUrn: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[LinkedInPublisher] Mock mode — LINKEDIN_CLIENT_ID missing');
      return `mock_linkedin_${Date.now()}`;
    }

    if (!shouldAllowRequest('linkedin')) {
      throw new Error('[LinkedInPublisher] Circuit breaker open for linkedin');
    }

    try {
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
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
          owner: this.authorUrn,
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

    // Step 4: Build post commentary
    const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const commentary = `${meta.caption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`.slice(
      0,
      MAX_COMMENTARY_LEN,
    );

    // Step 5: Create post via /v2/posts
    const postRes = await fetch(`${LI_API}/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202304',
      },
      body: JSON.stringify({
        author: this.authorUrn,
        commentary,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: {
            title: (meta.title ?? meta.caption).slice(0, 200),
            id: assetUrn,
          },
        },
        contentCallToActionLabel: meta.productLink ? 'LEARN_MORE' : undefined,
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });

    if (!postRes.ok) {
      const text = await postRes.text();
      throw new Error(`[LinkedInPublisher] Post creation failed (${postRes.status}): ${text}`);
    }

    const postData = (await postRes.json()) as PostCreateResponse;
    recordSuccess('linkedin');
    return postData.id;
    } catch (error) {
      recordFailure('linkedin', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    if (!shouldAllowRequest('linkedin')) return 'processing';

    try {
    // LinkedIn posts are synchronously published — check existence
    const encodedUrn = encodeURIComponent(externalPostId);
    const res = await fetch(`${LI_API}/v2/posts/${encodedUrn}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202304',
      },
    });

    if (res.status === 404) return 'failed';
    if (!res.ok) return 'failed';
    recordSuccess('linkedin');
    return 'live';
    } catch (error) {
      recordFailure('linkedin', classifyError(error));
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    if (!shouldAllowRequest('linkedin')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    try {
    const encodedUrn = encodeURIComponent(externalPostId);
    const res = await fetch(
      `${LI_API}/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}&shares[0]=${encodedUrn}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    if (!res.ok) return { views: 0, likes: 0, comments: 0, shares: 0 };

    const data = (await res.json()) as VideoStatsResponse;
    const stats = data.elements?.[0]?.totalShareStatistics ?? {};
    recordSuccess('linkedin');
    return {
      views: stats.impressionCount ?? 0,
      likes: stats.likeCount ?? 0,
      comments: stats.commentCount ?? 0,
      shares: stats.shareCount ?? 0,
    };
    } catch (error) {
      recordFailure('linkedin', classifyError(error));
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async delete(postId: string): Promise<void> {
  // Platform-specific deletion not implemented
  logger.warn("[linkedin-publisher.ts] delete not implemented");
}}