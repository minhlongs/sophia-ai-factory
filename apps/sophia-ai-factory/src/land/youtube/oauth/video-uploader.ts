import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { YOUTUBE_UPLOAD_URL, type UploadVideoParams } from './types';
import { assertOk } from './credentials';

/** Upload a video via resumable upload and return the YouTube watch URL */
export async function uploadVideo(params: UploadVideoParams): Promise<string> {
  if (!shouldAllowRequest('youtube')) {
    throw new Error('Circuit open for youtube — upload blocked');
  }
  try {
    const { accessToken, videoUrl, title, description, tags } = params;

    const videoRes = await fetch(videoUrl);
    await assertOk(videoRes, 'Video source fetch');
    const videoBlob = await videoRes.blob();
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

    const metadata = {
      snippet: { title, description, tags, categoryId: '22' },
      status: { privacyStatus: 'public' },
    };

    const initRes = await fetch(
      `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBlob.size),
        },
        body: JSON.stringify(metadata),
      },
    );
    await assertOk(initRes, 'YouTube upload initiation');

    const uploadUri = initRes.headers.get('Location');
    if (!uploadUri) throw new Error('YouTube did not return a resumable upload URI');

    const uploadRes = await fetch(uploadUri, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(videoBlob.size),
      },
      body: videoBlob,
    });
    await assertOk(uploadRes, 'YouTube video upload');

    const result = (await uploadRes.json()) as { id: string };
    recordSuccess('youtube');
    return `https://www.youtube.com/watch?v=${result.id}`;
  } catch (error) {
    recordFailure('youtube', classifyError(error));
    throw error;
  }
}
