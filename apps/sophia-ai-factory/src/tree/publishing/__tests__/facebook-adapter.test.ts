import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { facebookAdapter } from '../facebook-adapter';
import { reset } from '@/seed/security/circuit-breaker';

const VIDEO_URL = 'https://example.com/video.mp4';
const PAGE_TOKEN = 'EAA_TEST_PAGE_TOKEN';
const ACCESS_TOKEN = `123:page:${PAGE_TOKEN}`;

function mockFetchSequence(responses: Array<Response>) {
  let i = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const r = responses[i++] ?? responses[responses.length - 1];
    return r;
  });
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('facebookAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    reset('facebook');
  });
  afterEach(() => {
    reset('facebook');
  });

  it('uploads via the two-step Reels flow and returns processing status', async () => {
    // Adapter makes 4 fetches: start, fetch video bytes, upload bytes, finish.
    mockFetchSequence([
      jsonRes({ video_id: 'fb-v-1', upload_url: 'https://upload.fb/v1' }), // start
      new Response('binary', { status: 200 }), // fetch video bytes
      new Response('binary', { status: 200 }), // upload bytes
      jsonRes({ id: 'fb-v-1', status: 'published' }), // finish
    ]);
    const r = await facebookAdapter.uploadVideo(ACCESS_TOKEN, {
      videoUrl: VIDEO_URL,
      title: 'Test',
      description: 'Desc',
    });
    expect(r.platformVideoId).toBe('fb-v-1');
    expect(r.status).toBe('processing');
    expect(r.url).toContain('facebook.com/123/videos/fb-v-1');
  });

  it('fails when start upload returns no video_id', async () => {
    mockFetchSequence([jsonRes({ upload_url: 'https://upload.fb' })]);
    await expect(
      facebookAdapter.uploadVideo(ACCESS_TOKEN, { videoUrl: VIDEO_URL, title: 't', description: '' }),
    ).rejects.toThrow('Facebook did not return video_id or upload_url');
  });

  it('throws on 401 start upload (AUTH_FAILURE classification path)', async () => {
    mockFetchSequence([jsonRes({ error: { message: 'bad token' } }, 401)]);
    await expect(
      facebookAdapter.uploadVideo(ACCESS_TOKEN, { videoUrl: VIDEO_URL, title: 't', description: '' }),
    ).rejects.toThrow('Facebook upload start failed: 401');
  });

  it('fails loud on 500 start upload', async () => {
    mockFetchSequence([new Response('oops', { status: 500 })]);
    await expect(
      facebookAdapter.uploadVideo(ACCESS_TOKEN, { videoUrl: VIDEO_URL, title: 't', description: '' }),
    ).rejects.toThrow('Facebook upload start failed: 500');
  });

  it('throws on finish failure with status in message', async () => {
    // Adapter makes 4 fetches: start, fetch video bytes, upload bytes, finish.
    mockFetchSequence([
      jsonRes({ video_id: 'fb-v-2', upload_url: 'https://upload.fb/v2' }), // start
      new Response('binary', { status: 200 }), // fetch video bytes
      new Response('binary', { status: 200 }), // upload bytes
      jsonRes({ error: { message: 'publish rejected' } }, 403), // finish
    ]);
    await expect(
      facebookAdapter.uploadVideo(ACCESS_TOKEN, { videoUrl: VIDEO_URL, title: 't', description: '' }),
    ).rejects.toThrow('Facebook finish upload failed: 403');
  });

  it('checkStatus returns published when video_status is published', async () => {
    mockFetchSequence([
      jsonRes({ status: { video_status: 'published' }, permalink_url: 'https://fb.com/x' }),
    ]);
    const s = await facebookAdapter.checkStatus(ACCESS_TOKEN, 'fb-v-1');
    expect(s.status).toBe('published');
  });

  it('checkStatus returns failed when processing_phase is failed', async () => {
    mockFetchSequence([
      jsonRes({ status: { processing_phase: { status: 'failed' } } }),
    ]);
    const s = await facebookAdapter.checkStatus(ACCESS_TOKEN, 'fb-v-1');
    expect(s.status).toBe('failed');
    expect(s.error).toBe('Video processing failed');
  });

  it('checkStatus returns processing for intermediate state', async () => {
    mockFetchSequence([jsonRes({ status: { video_status: 'processing' } })]);
    const s = await facebookAdapter.checkStatus(ACCESS_TOKEN, 'fb-v-1');
    expect(s.status).toBe('processing');
  });

  it('refreshToken returns access_token and expiresIn', async () => {
    mockFetchSequence([jsonRes({ access_token: 'new-tok', expires_in: 5184000 })]);
    const r = await facebookAdapter.refreshToken('cid', 'csec', 'rtok');
    expect(r.accessToken).toBe('new-tok');
    expect(r.expiresIn).toBe(5184000);
  });

  it('refreshToken throws on non-200', async () => {
    mockFetchSequence([new Response('nope', { status: 400 })]);
    await expect(facebookAdapter.refreshToken('cid', 'csec', 'rtok')).rejects.toThrow(
      'Facebook token refresh failed: 400',
    );
  });
});