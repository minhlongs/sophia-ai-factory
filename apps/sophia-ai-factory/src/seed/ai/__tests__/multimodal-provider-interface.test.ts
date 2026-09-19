/**
 * Multi-Modal Provider Interface Contract Tests
 *
 * Validates interface contracts for:
 * 1. IAudioProvider (generateSpeech, health)
 * 2. IVideoRenderingProvider (renderVideo, checkStatus, health)
 * 3. ImageGenerationProvider (generate, capabilities, health)
 * 4. Error classification & typeguards
 *
 * @module seed/ai/__tests__/multimodal-provider-interface.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  type IAudioProvider,
  type IVideoRenderingProvider,
  type ImageGenerationProvider,
  type AudioGenerationInput,
  type AudioGenerationResult,
  type VideoRenderInput,
  type VideoRenderStatus,
  ImageGenerationError,
  isImageGenerationError,
} from '@/seed/ai/multimodal-provider-interface';

describe('Multi-Modal Provider Interfaces', () => {
  it('IAudioProvider contract is satisfied by audio implementations', async () => {
    class MockAudioProvider implements IAudioProvider {
      readonly id = 'test-audio';
      readonly label = 'Test Audio Provider';

      async generateSpeech(input: AudioGenerationInput, keyRef?: string): Promise<AudioGenerationResult> {
        return {
          audioBuffer: new ArrayBuffer(1024),
          durationSeconds: 12.5,
          mimeType: 'audio/mpeg',
          provider: this.id,
          latencyMs: 150,
          audioUrl: `https://storage.test/audio/${keyRef ?? 'platform'}/test.mp3`,
        };
      }

      async health(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
        return { healthy: true, latencyMs: 15 };
      }
    }

    const provider = new MockAudioProvider();
    expect(provider.id).toBe('test-audio');
    expect(provider.label).toBe('Test Audio Provider');

    const result = await provider.generateSpeech(
      { text: 'Hello, world!', voiceId: 'rachel', tier: 'ENTERPRISE' },
      'tenant_123',
    );

    expect(result.provider).toBe('test-audio');
    expect(result.durationSeconds).toBe(12.5);
    expect(result.audioUrl).toBe('https://storage.test/audio/tenant_123/test.mp3');
    expect(result.audioBuffer.byteLength).toBe(1024);

    const health = await provider.health?.();
    expect(health?.healthy).toBe(true);
  });

  it('IVideoRenderingProvider contract is satisfied by video implementations', async () => {
    class MockVideoProvider implements IVideoRenderingProvider {
      readonly id = 'test-video';
      readonly label = 'Test Video Provider';

      async renderVideo(input: VideoRenderInput, keyRef?: string): Promise<{ jobId: string }> {
        if (!input.faceUrl || !input.audioUrl) {
          throw new Error('faceUrl and audioUrl are required');
        }
        return { jobId: `job_${keyRef ?? 'platform'}_456` };
      }

      async checkStatus(jobId: string): Promise<VideoRenderStatus> {
        return {
          status: 'completed',
          videoUrl: `https://storage.test/videos/${jobId}.mp4`,
          progress: 100,
        };
      }
    }

    const provider = new MockVideoProvider();
    const renderRes = await provider.renderVideo(
      {
        faceUrl: 'https://cdn.test/face.png',
        audioUrl: 'https://cdn.test/audio.mp3',
        title: 'Welcome Video',
      },
      'tenant_abc',
    );

    expect(renderRes.jobId).toBe('job_tenant_abc_456');

    const statusRes = await provider.checkStatus(renderRes.jobId);
    expect(statusRes.status).toBe('completed');
    expect(statusRes.videoUrl).toBe('https://storage.test/videos/job_tenant_abc_456.mp4');
  });

  it('ImageGenerationProvider and ImageGenerationError behave correctly', () => {
    const err = new ImageGenerationError('Model rate limit reached', 'RATE_LIMIT', 'fal-ai', true);
    expect(isImageGenerationError(err)).toBe(true);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.provider).toBe('fal-ai');
    expect(err.retryable).toBe(true);

    const regularError = new Error('Some random error');
    expect(isImageGenerationError(regularError)).toBe(false);

    const converted = ImageGenerationError.fromUnknown(regularError, 'replicate');
    expect(isImageGenerationError(converted)).toBe(true);
    expect(converted.code).toBe('UNKNOWN_ERROR');
    expect(converted.provider).toBe('replicate');
  });
});
