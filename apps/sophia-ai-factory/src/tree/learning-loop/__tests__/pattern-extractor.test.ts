/**
 * Tests for Creative Pattern Extractor (Phase 5 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  bucketDurationPattern,
  extractHookStyleFromScene0,
  extractVoiceProfileFromMetadata,
  extractCreativeVariables,
} from '../pattern-extractor';
import type { LearningLoopAssetInput } from '../types';

describe('pattern-extractor', () => {
  describe('bucketDurationPattern', () => {
    it('buckets durations into correct short-form ranges', () => {
      expect(bucketDurationPattern(0)).toBe('0-15s');
      expect(bucketDurationPattern(10)).toBe('0-15s');
      expect(bucketDurationPattern(15)).toBe('0-15s');

      expect(bucketDurationPattern(16)).toBe('16-30s');
      expect(bucketDurationPattern(30)).toBe('16-30s');

      expect(bucketDurationPattern(31)).toBe('31-60s');
      expect(bucketDurationPattern(45)).toBe('31-60s');
      expect(bucketDurationPattern(60)).toBe('31-60s');

      expect(bucketDurationPattern(61)).toBe('61-90s');
      expect(bucketDurationPattern(90)).toBe('61-90s');

      expect(bucketDurationPattern(91)).toBe('90s+');
      expect(bucketDurationPattern(180)).toBe('90s+');
    });

    it('handles string representations of numbers', () => {
      expect(bucketDurationPattern('12')).toBe('0-15s');
      expect(bucketDurationPattern('25')).toBe('16-30s');
      expect(bucketDurationPattern('55')).toBe('31-60s');
      expect(bucketDurationPattern('75')).toBe('61-90s');
      expect(bucketDurationPattern('100')).toBe('90s+');
    });

    it('handles edge cases, negative numbers, and null/empty gracefully', () => {
      expect(bucketDurationPattern(-10)).toBe('0-15s');
      expect(bucketDurationPattern(null)).toBe('0-15s');
      expect(bucketDurationPattern(undefined)).toBe('0-15s');
      expect(bucketDurationPattern('')).toBe('0-15s');
      expect(bucketDurationPattern('invalid_number')).toBe('0-15s');
    });
  });

  describe('extractHookStyleFromScene0', () => {
    it('respects explicit valid hook style tags', () => {
      expect(extractHookStyleFromScene0({ hookStyle: 'curiosity_gap' })).toBe('curiosity_gap');
      expect(extractHookStyleFromScene0({ hook_style: 'bold_claim' })).toBe('bold_claim');
      expect(extractHookStyleFromScene0({ hookStyle: 'statistic_reveal' })).toBe('statistic_reveal');
    });

    it('classifies statistic_reveal hooks (bilingual EN & VI)', () => {
      expect(
        extractHookStyleFromScene0('90% of content creators make this mistake in their first 3 seconds.'),
      ).toBe('statistic_reveal');
      expect(
        extractHookStyleFromScene0('Hơn 85% người kinh doanh online không biết điều này.'),
      ).toBe('statistic_reveal');
      expect(
        extractHookStyleFromScene0('How I generated $10000 in passive affiliate income.'),
      ).toBe('statistic_reveal');
      expect(
        extractHookStyleFromScene0('3 lý do bạn không nên dùng template cũ.'),
      ).toBe('statistic_reveal');
      expect(
        extractHookStyleFromScene0({ prompt: '5 reasons why video retention drops after 5 seconds.' }),
      ).toBe('statistic_reveal');
    });

    it('classifies question hooks (bilingual EN & VI)', () => {
      expect(
        extractHookStyleFromScene0('Why are your short-form videos getting stuck at 200 views?'),
      ).toBe('question');
      expect(
        extractHookStyleFromScene0('Tại sao video của bạn không lên xu hướng?'),
      ).toBe('question');
      expect(
        extractHookStyleFromScene0('Did you know that 3 seconds decide your entire video reach?'),
      ).toBe('question');
      expect(
        extractHookStyleFromScene0('Làm thế nào để tạo 10 video mỗi ngày với AI?'),
      ).toBe('question');
      expect(
        extractHookStyleFromScene0({ narration: 'Bạn có biết bí mật của các kênh triệu view không?' }),
      ).toBe('question');
    });

    it('classifies problem_agitation hooks (bilingual EN & VI)', () => {
      expect(
        extractHookStyleFromScene0('Stop doing affiliate marketing like it is 2020!'),
      ).toBe('problem_agitation');
      expect(
        extractHookStyleFromScene0('Dừng lại ngay nếu bạn đang phí tiền chạy quảng cáo sai cách.'),
      ).toBe('problem_agitation');
      expect(
        extractHookStyleFromScene0('The biggest mistake beginner YouTubers make every single week.'),
      ).toBe('problem_agitation');
      expect(
        extractHookStyleFromScene0('Cảnh báo nguy hiểm khi tải video không rõ nguồn gốc.'),
      ).toBe('problem_agitation');
      expect(
        extractHookStyleFromScene0({ text: 'Tired of spending 5 hours editing one simple video?' }),
      ).toBe('problem_agitation');
    });

    it('classifies bold_claim hooks (bilingual EN & VI)', () => {
      expect(
        extractHookStyleFromScene0('This new AI workflow will completely change digital marketing forever.'),
      ).toBe('bold_claim');
      expect(
        extractHookStyleFromScene0('Đây là sự thật gây sốc về thuật toán đề xuất năm 2026.'),
      ).toBe('bold_claim');
      expect(
        extractHookStyleFromScene0('Nobody tells you how the top 1% agencies scale creative output.'),
      ).toBe('bold_claim');
      expect(
        extractHookStyleFromScene0('Đột phá công nghệ giúp tăng doanh thu gấp 10 lần.'),
      ).toBe('bold_claim');
    });

    it('classifies story_lead hooks (bilingual EN & VI)', () => {
      expect(
        extractHookStyleFromScene0('It all started when I was broke and had zero followers on TikTok.'),
      ).toBe('story_lead');
      expect(
        extractHookStyleFromScene0('Năm ngoái khi tôi bắt đầu xây dựng kênh từ con số không...'),
      ).toBe('story_lead');
      expect(
        extractHookStyleFromScene0('A few years ago I lost my full-time job and had to adapt.'),
      ).toBe('story_lead');
      expect(
        extractHookStyleFromScene0('Hồi đó tôi từng nghĩ làm video ngắn rất khó khăn.'),
      ).toBe('story_lead');
    });

    it('classifies curiosity_gap hooks (bilingual EN & VI)', () => {
      expect(
        extractHookStyleFromScene0('The secret method top creators use that you will not believe.'),
      ).toBe('curiosity_gap');
      expect(
        extractHookStyleFromScene0('Wait until the end to see the shocking transformation.'),
      ).toBe('curiosity_gap');
      expect(
        extractHookStyleFromScene0('Cái kết bất ngờ mà không ai lường trước được.'),
      ).toBe('curiosity_gap');
    });

    it('falls back to curiosity_gap for empty or unrecognized input', () => {
      expect(extractHookStyleFromScene0('')).toBe('curiosity_gap');
      expect(extractHookStyleFromScene0(null)).toBe('curiosity_gap');
      expect(extractHookStyleFromScene0(undefined)).toBe('curiosity_gap');
      expect(extractHookStyleFromScene0({ narration: '' })).toBe('curiosity_gap');
      expect(extractHookStyleFromScene0('Hello everyone today we review something.')).toBe('curiosity_gap');
    });
  });

  describe('extractVoiceProfileFromMetadata', () => {
    it('returns exact voice profile when explicitly provided', () => {
      expect(extractVoiceProfileFromMetadata({ voiceStyle: 'dynamic_hook' })).toEqual({
        voiceProfile: 'dynamic_hook',
        voiceId: undefined,
      });
      expect(extractVoiceProfileFromMetadata({ voice_style: 'cinematic_narrator', voiceId: 'voice_123' })).toEqual({
        voiceProfile: 'cinematic_narrator',
        voiceId: 'voice_123',
      });
    });

    it('matches fuzzy voice styles to canonical profiles', () => {
      expect(extractVoiceProfileFromMetadata({ voiceStyle: 'Fast and energetic hype voice' }).voiceProfile).toBe(
        'dynamic_hook',
      );
      expect(extractVoiceProfileFromMetadata({ voiceStyle: 'Friendly warm affiliate recommender' }).voiceProfile).toBe(
        'enthusiastic_recommender',
      );
      expect(extractVoiceProfileFromMetadata({ voiceStyle: 'Deep documentary storytelling narrator' }).voiceProfile).toBe(
        'cinematic_narrator',
      );
      expect(extractVoiceProfileFromMetadata({ voiceStyle: 'Corporate news professional expert' }).voiceProfile).toBe(
        'calm_authoritative',
      );
    });

    it('extracts voiceId across different metadata key conventions', () => {
      expect(extractVoiceProfileFromMetadata({ voiceId: 'rachel_1' }).voiceId).toBe('rachel_1');
      expect(extractVoiceProfileFromMetadata({ voice_id: 'adam_2' }).voiceId).toBe('adam_2');
      expect(extractVoiceProfileFromMetadata({ providerVoiceId: 'eleven_3' }).voiceId).toBe('eleven_3');
    });

    it('defaults to calm_authoritative when metadata is empty or missing', () => {
      expect(extractVoiceProfileFromMetadata()).toEqual({
        voiceProfile: 'calm_authoritative',
        voiceId: undefined,
      });
      expect(extractVoiceProfileFromMetadata({})).toEqual({
        voiceProfile: 'calm_authoritative',
        voiceId: undefined,
      });
    });
  });

  describe('extractCreativeVariables', () => {
    it('extracts comprehensive variables from mission and media assets', () => {
      const mission = {
        id: 'msn_test_123',
        workspaceId: 'ws_test_456',
        channels: ['tiktok', 'youtube_shorts'],
        title: 'High Converting Shorts',
      };

      const assets: LearningLoopAssetInput[] = [
        {
          id: 'asset_script_1',
          projectId: 'msn_test_123',
          workspaceId: 'ws_test_456',
          type: 'script',
          metadata: {
            scenesCount: 4,
            scenes: [
              {
                index: 1,
                narration: 'Did you know why 90% of videos fail in the first 3 seconds?',
                prompt: 'Dramatic cinematic close-up of creator looking shocked',
              },
              {
                index: 2,
                narration: 'The problem is not the content, it is the initial hook.',
              },
            ],
          },
        },
        {
          id: 'asset_audio_1',
          projectId: 'msn_test_123',
          workspaceId: 'ws_test_456',
          type: 'audio',
          durationSeconds: 42,
          metadata: {
            voiceStyle: 'dynamic_hook',
            voiceId: 'eleven_rachel_v2',
          },
        },
        {
          id: 'asset_video_1',
          projectId: 'msn_test_123',
          workspaceId: 'ws_test_456',
          type: 'video',
          durationSeconds: 42,
          metadata: {
            aspectRatio: '9:16',
            scenesCount: 4,
          },
        },
      ];

      const result = extractCreativeVariables(mission, assets);

      expect(result.missionId).toBe('msn_test_123');
      expect(result.workspaceId).toBe('ws_test_456');
      expect(result.hookStyle).toBe('statistic_reveal');
      expect(result.voiceProfile).toBe('dynamic_hook');
      expect(result.voiceId).toBe('eleven_rachel_v2');
      expect(result.durationPattern).toBe('31-60s');
      expect(result.actualDurationSeconds).toBe(42);
      expect(result.aspectRatio).toBe('9:16');
      expect(result.sceneCount).toBe(4);
      expect(result.channels).toEqual(['tiktok', 'youtube_shorts']);
    });

    it('handles fallback gracefully when media assets are minimal or missing', () => {
      const mission = {
        id: 'msn_minimal_1',
        workspaceId: 'ws_minimal_2',
        constraints: {
          durationSeconds: 25,
          aspectRatio: '16:9',
          hookStyle: 'bold_claim',
        },
      };

      const result = extractCreativeVariables(mission, []);

      expect(result.missionId).toBe('msn_minimal_1');
      expect(result.workspaceId).toBe('ws_minimal_2');
      expect(result.hookStyle).toBe('bold_claim');
      expect(result.voiceProfile).toBe('calm_authoritative');
      expect(result.durationPattern).toBe('16-30s');
      expect(result.actualDurationSeconds).toBe(25);
      expect(result.aspectRatio).toBe('16:9');
    });
  });
});
