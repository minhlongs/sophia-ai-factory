/**
 * tree/help/__tests__/types.test.ts
 * Unit tests for Help Video types
 */
import { describe, it, expect } from 'vitest';
import {
  HelpVideoSchema,
  HelpVideoCategorySchema,
  LocalizedHelpVideoSchema,
  CreateHelpVideoInputSchema,
  UpdateHelpVideoInputSchema,
  MarkWatchedInputSchema,
  UnmarkWatchedInputSchema,
  HelpVideoProgressSchema,
  UserProgressSummarySchema,
} from '../types';

describe('Help Video Types', () => {
  it('validates HelpVideoCategory enum', () => {
    const validCategories = [
      'getting-started',
      'setup',
      'integrations',
      'content',
      'analytics',
      'compliance',
      'advanced',
      'support',
    ];

    for (const cat of validCategories) {
      expect(() => HelpVideoCategorySchema.parse(cat)).not.toThrow();
    }

    expect(() => HelpVideoCategorySchema.parse('invalid')).toThrow();
  });

  it('validates HelpVideoSchema', () => {
    const validVideo = {
      id: 'hv_123',
      slug: 'welcome',
      title_en: 'Welcome',
      title_vi: 'Chào mừng',
      description_en: 'Welcome to Sophia',
      description_vi: 'Chào mừng đến Sophia',
      r2_key: null,
      duration_sec: 90,
      category: 'getting-started',
      order_index: 1,
      published: 1,
      created_at: Date.now(),
    };

    expect(() => HelpVideoSchema.parse(validVideo)).not.toThrow();
  });

  it('validates LocalizedHelpVideoSchema', () => {
    const validLocalized = {
      id: 'hv_123',
      slug: 'welcome',
      title_en: 'Welcome',
      title_vi: 'Chào mừng',
      description_en: 'Welcome to Sophia',
      description_vi: 'Chào mừng đến Sophia',
      r2_key: null,
      duration_sec: 90,
      category: 'getting-started',
      order_index: 1,
      published: 1,
      created_at: Date.now(),
      title: 'Welcome',
      description: 'Welcome to Sophia',
      locale: 'en',
    };

    expect(() => LocalizedHelpVideoSchema.parse(validLocalized)).not.toThrow();
  });

  it('validates CreateHelpVideoInputSchema', () => {
    const validInput = {
      id: 'hv_123',
      slug: 'welcome',
      title_en: 'Welcome',
      title_vi: 'Chào mừng',
      description_en: 'Welcome to Sophia',
      description_vi: 'Chào mừng đến Sophia',
      r2_key: null,
      duration_sec: 90,
      category: 'getting-started',
      order_index: 1,
      published: 0,
    };

    expect(() => CreateHelpVideoInputSchema.parse(validInput)).not.toThrow();
  });

  it('validates UpdateHelpVideoInputSchema requires at least one field', () => {
    expect(() => UpdateHelpVideoInputSchema.parse({})).toThrow();
    expect(() => UpdateHelpVideoInputSchema.parse({ title_en: 'Updated' })).not.toThrow();
  });

  it('validates MarkWatchedInputSchema', () => {
    const validInput = {
      user_id: 'user_123',
      video_id: 'hv_123',
      locale: 'en',
    };

    expect(() => MarkWatchedInputSchema.parse(validInput)).not.toThrow();

    // locale defaults to 'en'
    const withoutLocale = {
      user_id: 'user_123',
      video_id: 'hv_123',
    };
    const parsed = MarkWatchedInputSchema.parse(withoutLocale);
    expect(parsed.locale).toBe('en');
  });

  it('validates UnmarkWatchedInputSchema', () => {
    const validInput = {
      user_id: 'user_123',
      video_id: 'hv_123',
      locale: 'vi',
    };

    expect(() => UnmarkWatchedInputSchema.parse(validInput)).not.toThrow();
  });

  it('validates HelpVideoProgressSchema', () => {
    const validProgress = {
      user_id: 'user_123',
      video_id: 'hv_123',
      locale: 'en',
      watched_at: Date.now(),
    };

    expect(() => HelpVideoProgressSchema.parse(validProgress)).not.toThrow();
  });

  it('validates UserProgressSummarySchema', () => {
    const validSummary = {
      user_id: 'user_123',
      locale: 'en',
      total_videos: 10,
      watched_videos: 5,
      completion_percentage: 50,
    };

    expect(() => UserProgressSummarySchema.parse(validSummary)).not.toThrow();
  });
});