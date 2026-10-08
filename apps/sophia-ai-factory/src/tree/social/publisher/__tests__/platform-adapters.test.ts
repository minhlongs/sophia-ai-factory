import { describe, it, expect } from 'vitest';
import {
  calculateYouTubeChunks,
  buildYouTubeInitRequest,
  calculateTikTokChunks,
  buildTikTokInitPayload,
  buildTikTokStatusPollingRequest,
  parseTikTokPublishStatus,
  buildInstagramContainerInit,
  buildInstagramStatusCheck,
  parseInstagramContainerStatus,
  buildInstagramPublishRequest,
  YOUTUBE_CHUNK_UNIT_BYTES,
  YOUTUBE_DEFAULT_CHUNK_SIZE,
} from '../platform-adapters';

describe('platform-adapters', () => {
  describe('YouTube Shorts Resumable Chunking & Init', () => {
    it('slices exact 256 KiB aligned chunks for 10 MiB video', () => {
      const totalSize = 10 * 1024 * 1024; // 10,485,760 bytes
      const chunks = calculateYouTubeChunks(totalSize, YOUTUBE_DEFAULT_CHUNK_SIZE);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].start).toBe(0);
      expect(chunks[0].end).toBe(5242879);
      expect(chunks[0].size).toBe(5242880);
      expect(chunks[0].contentRangeHeader).toBe(`bytes 0-5242879/${totalSize}`);

      expect(chunks[1].start).toBe(5242880);
      expect(chunks[1].end).toBe(totalSize - 1);
      expect(chunks[1].size).toBe(5242880);
      expect(chunks[0].size % YOUTUBE_CHUNK_UNIT_BYTES).toBe(0);
    });

    it('rejects unaligned chunk sizes and invalid byte counts', () => {
      expect(() => calculateYouTubeChunks(0)).toThrow('greater than 0');
      expect(() => calculateYouTubeChunks(1000, 300000)).toThrow('multiple of 262144');
    });

    it('builds YouTube session init payload with #Shorts tag', () => {
      const req = buildYouTubeInitRequest({
        title: 'Insane AI Workflow',
        description: 'Watch how this AI creates video.',
        totalSizeBytes: 5242880,
        tags: ['AI', 'Tech'],
      });

      expect(req.headers['X-Upload-Content-Length']).toBe('5242880');
      expect(req.body.snippet.description).toContain('#Shorts');
      expect(req.body.snippet.tags).toContain('Shorts');
      expect(req.body.status.selfDeclaredMadeForKids).toBe(false);
    });
  });

  describe('TikTok Content Posting API v2', () => {
    it('creates single chunk for small video under 5MB', () => {
      const info = calculateTikTokChunks(3 * 1024 * 1024);
      expect(info.totalChunks).toBe(1);
      expect(info.chunks[0].size).toBe(3 * 1024 * 1024);
      expect(info.chunkSize).toBe(3 * 1024 * 1024);
    });

    it('clamps chunk size between 5MB and 64MB for large video', () => {
      const totalSize = 12 * 1024 * 1024;
      const info = calculateTikTokChunks(totalSize, 5 * 1024 * 1024);
      expect(info.totalChunks).toBe(3);
      expect(info.chunks[0].size).toBe(5242880);
      expect(info.chunks[2].end).toBe(totalSize - 1);
    });

    it('builds TikTok init payload with FILE_UPLOAD', () => {
      const init = buildTikTokInitPayload({
        title: 'Crazy Viral Product',
        totalSizeBytes: 10485760,
      });

      expect(init.endpoint).toContain('/v2/post/publish/video/init/');
      expect(init.body.source_info.source).toBe('FILE_UPLOAD');
      expect(init.body.post_mode).toBe('DIRECT_POST');
      expect(init.chunks).toHaveLength(2);
    });

    it('builds status fetch request and parses terminal states', () => {
      const poll = buildTikTokStatusPollingRequest('pub_xyz123');
      expect(poll.body.publish_id).toBe('pub_xyz123');

      expect(parseTikTokPublishStatus({ data: { status: 'SUCCESS_PUBLISH' } })).toEqual({
        status: 'SUCCESS_PUBLISH',
        isTerminal: true,
      });
      expect(parseTikTokPublishStatus({ data: { status: 'FAILED', fail_reason: 'COPYRIGHT' } })).toEqual({
        status: 'FAILED',
        isTerminal: true,
        failReason: 'COPYRIGHT',
      });
      expect(parseTikTokPublishStatus({ data: { status: 'PROCESSING_UPLOAD' } })).toEqual({
        status: 'PROCESSING_UPLOAD',
        isTerminal: false,
      });
      expect(parseTikTokPublishStatus(null)).toEqual({ status: 'UNKNOWN', isTerminal: false });
    });
  });

  describe('Instagram Reels Graph API 3-step Lifecycle', () => {
    it('builds container init and rejects insecure URLs', () => {
      expect(() => buildInstagramContainerInit('ig_user_1', {
        videoUrl: 'http://insecure.com/video.mp4',
        caption: 'Test Reels',
      })).toThrow('secure public HTTPS URL');

      const init = buildInstagramContainerInit('ig_user_1', {
        videoUrl: 'https://cdn.agencyos.network/r2/reels.mp4',
        caption: 'Scale your SaaS',
        shareToFeed: true,
      });
      expect(init.endpoint).toBe('https://graph.facebook.com/v21.0/ig_user_1/media');
      expect(init.body.media_type).toBe('REELS');
      expect(init.body.video_url).toBe('https://cdn.agencyos.network/r2/reels.mp4');
    });

    it('builds status check and parses container states', () => {
      const check = buildInstagramStatusCheck('creation_999');
      expect(check.endpoint).toBe('https://graph.facebook.com/v21.0/creation_999');

      expect(parseInstagramContainerStatus({ status_code: 'FINISHED' })).toEqual({
        statusCode: 'FINISHED',
        isReadyToPublish: true,
        isFailed: false,
      });
      expect(parseInstagramContainerStatus({ status_code: 'IN_PROGRESS' })).toEqual({
        statusCode: 'IN_PROGRESS',
        isReadyToPublish: false,
        isFailed: false,
      });
      expect(parseInstagramContainerStatus({ status_code: 'ERROR' })).toEqual({
        statusCode: 'ERROR',
        isReadyToPublish: false,
        isFailed: true,
      });
      expect(parseInstagramContainerStatus(undefined)).toEqual({
        statusCode: 'UNKNOWN',
        isReadyToPublish: false,
        isFailed: false,
      });
    });

    it('builds media publish request', () => {
      const pub = buildInstagramPublishRequest('ig_user_1', 'creation_999');
      expect(pub.endpoint).toBe('https://graph.facebook.com/v21.0/ig_user_1/media_publish');
      expect(pub.body.creation_id).toBe('creation_999');
    });
  });
});
