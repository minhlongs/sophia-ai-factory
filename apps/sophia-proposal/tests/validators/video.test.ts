/**
 * Video Validators Tests
 *
 * Tests the video validation schemas:
 * - Generate video request validation
 * - Video status response validation
 * - Webhook payload validation
 */

import { describe, it, expect } from 'vitest';
import {
  generateVideoSchema,
  videoTypeEnum,
  videoStatusEnum,
  heygenWebhookSchema,
} from '@/lib/validators/video';

describe('Video Validators', () => {
  describe('Video Type Enum', () => {
    it('should accept valid video types', () => {
      expect(videoTypeEnum.safeParse('intro').success).toBe(true);
      expect(videoTypeEnum.safeParse('section').success).toBe(true);
      expect(videoTypeEnum.safeParse('full_proposal').success).toBe(true);
      expect(videoTypeEnum.safeParse('custom').success).toBe(true);
    });

    it('should reject invalid video types', () => {
      expect(videoTypeEnum.safeParse('invalid').success).toBe(false);
      expect(videoTypeEnum.safeParse('').success).toBe(false);
    });
  });

  describe('Video Status Enum', () => {
    it('should accept valid status values', () => {
      expect(videoStatusEnum.safeParse('pending').success).toBe(true);
      expect(videoStatusEnum.safeParse('processing').success).toBe(true);
      expect(videoStatusEnum.safeParse('ready').success).toBe(true);
      expect(videoStatusEnum.safeParse('failed').success).toBe(true);
    });

    it('should reject invalid status values', () => {
      expect(videoStatusEnum.safeParse('unknown').success).toBe(false);
    });
  });

  describe('Generate Video Schema', () => {
    const validInput = {
      proposalId: '123e4567-e89b-12d3-a456-426614174000',
      videoType: 'intro' as const,
      scriptText: 'This is a test script for video generation. It has enough characters.',
    };

    it('should accept valid input', () => {
      const result = generateVideoSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const inputWithOptional = {
        ...validInput,
        templateId: '123e4567-e89b-12d3-a456-426614174001',
        avatarId: 'avatar_001',
        voiceId: 'voice_001',
        backgroundId: 'bg_001',
      };
      const result = generateVideoSchema.safeParse(inputWithOptional);
      expect(result.success).toBe(true);
    });

    it('should reject invalid proposal ID', () => {
      const invalidInput = { ...validInput, proposalId: 'not-a-uuid' };
      const result = generateVideoSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].path).toContain('proposalId');
    });

    it('should reject script that is too short', () => {
      const invalidInput = { ...validInput, scriptText: 'Too short' };
      const result = generateVideoSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject script that is too long', () => {
      const invalidInput = { ...validInput, scriptText: 'a'.repeat(5001) };
      const result = generateVideoSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = generateVideoSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid video type', () => {
      const invalidInput = { ...validInput, videoType: 'invalid' };
      const result = generateVideoSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('HeyGen Webhook Schema', () => {
    const validCompletedPayload = {
      event: 'task.completed' as const,
      task_id: 'task_123',
      video_id: 'video_456',
      video_url: 'https://heygen.com/videos/video_456.mp4',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const validFailedPayload = {
      event: 'task.failed' as const,
      task_id: 'task_123',
      video_id: 'video_456',
      error_message: 'Video generation failed due to invalid avatar',
      timestamp: '2024-01-01T00:00:00Z',
    };

    it('should accept valid completed payload', () => {
      const result = heygenWebhookSchema.safeParse(validCompletedPayload);
      expect(result.success).toBe(true);
    });

    it('should accept valid failed payload', () => {
      const result = heygenWebhookSchema.safeParse(validFailedPayload);
      expect(result.success).toBe(true);
    });

    it('should reject invalid event type', () => {
      const invalidPayload = { ...validCompletedPayload, event: 'invalid' };
      const result = heygenWebhookSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = heygenWebhookSchema.safeParse({ event: 'task.completed' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid video URL', () => {
      const invalidPayload = { ...validCompletedPayload, video_url: 'not-a-url' };
      const result = heygenWebhookSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
