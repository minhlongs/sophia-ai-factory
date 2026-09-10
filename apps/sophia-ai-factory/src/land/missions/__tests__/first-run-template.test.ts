/**
 * Unit tests for First-Run Template Engine
 * @module land/missions/__tests__/first-run-template
 */

import { describe, it, expect } from 'vitest';
import {
  FIRST_RUN_TEMPLATES,
  getFirstRunTemplates,
  getTemplateById,
  getDefaultTemplate,
  type TemplateId,
  type FirstRunTemplate,
} from '../first-run-template';

describe('first-run-template', () => {
  describe('Template Registry', () => {
    it('has exactly 3 starter templates', () => {
      const templates = getFirstRunTemplates();
      expect(templates).toHaveLength(3);
    });

    it('contains viral_shorts_explainer template', () => {
      const template = FIRST_RUN_TEMPLATES.viral_shorts_explainer;
      expect(template).toBeDefined();
      expect(template.id).toBe('viral_shorts_explainer');
      expect(template.durationSeconds).toBe(60);
      expect(template.aspectRatio).toBe('9:16');
      expect(template.targetPlatform).toBe('youtube_shorts');
      expect(template.targetWordCount).toBe(140);
      expect(template.estimatedScenes).toBe(5);
    });

    it('contains affiliate_product_showcase template', () => {
      const template = FIRST_RUN_TEMPLATES.affiliate_product_showcase;
      expect(template).toBeDefined();
      expect(template.id).toBe('affiliate_product_showcase');
      expect(template.durationSeconds).toBe(30);
      expect(template.aspectRatio).toBe('9:16');
      expect(template.targetPlatform).toBe('tiktok');
      expect(template.targetWordCount).toBe(75);
      expect(template.estimatedScenes).toBe(3);
    });

    it('contains daily_news_wisdom template', () => {
      const template = FIRST_RUN_TEMPLATES.daily_news_wisdom;
      expect(template).toBeDefined();
      expect(template.id).toBe('daily_news_wisdom');
      expect(template.durationSeconds).toBe(45);
      expect(template.aspectRatio).toBe('9:16');
      expect(template.targetPlatform).toBe('youtube_shorts');
      expect(template.targetWordCount).toBe(110);
      expect(template.estimatedScenes).toBe(4);
    });

    it('all templates have bilingual name, description, badge, and defaultTopic', () => {
      Object.values(FIRST_RUN_TEMPLATES).forEach((t) => {
        expect(t.name.en).toBeTruthy();
        expect(t.name.vi).toBeTruthy();
        expect(t.description.en).toBeTruthy();
        expect(t.description.vi).toBeTruthy();
        expect(t.badge.en).toBeTruthy();
        expect(t.badge.vi).toBeTruthy();
        expect(t.defaultTopic.en).toBeTruthy();
        expect(t.defaultTopic.vi).toBeTruthy();
      });
    });

    it('all templates have suggestedPrompts with bilingual content', () => {
      Object.values(FIRST_RUN_TEMPLATES).forEach((t) => {
        expect(t.suggestedPrompts.length).toBeGreaterThan(0);
        t.suggestedPrompts.forEach((p) => {
          expect(p.en).toBeTruthy();
          expect(p.vi).toBeTruthy();
        });
      });
    });

    it('all templates have voiceStyle and visualStyle defined', () => {
      Object.values(FIRST_RUN_TEMPLATES).forEach((t) => {
        expect(t.voiceStyle).toBeTruthy();
        expect(t.visualStyle).toBeTruthy();
      });
    });

    it('all templates have bilingual callToAction', () => {
      Object.values(FIRST_RUN_TEMPLATES).forEach((t) => {
        expect(t.callToAction.en).toBeTruthy();
        expect(t.callToAction.vi).toBeTruthy();
      });
    });
  });

  describe('getFirstRunTemplates', () => {
    it('returns all 3 templates as array', () => {
      const templates = getFirstRunTemplates();
      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.id).sort()).toEqual([
        'affiliate_product_showcase',
        'daily_news_wisdom',
        'viral_shorts_explainer',
      ]);
    });
  });

  describe('getTemplateById', () => {
    it('returns correct template for valid ID', () => {
      const template = getTemplateById('viral_shorts_explainer');
      expect(template).toBeDefined();
      expect(template?.id).toBe('viral_shorts_explainer');
    });

    it('returns undefined for invalid ID', () => {
      const template = getTemplateById('invalid_id' as TemplateId);
      expect(template).toBeUndefined();
    });
  });

  describe('getDefaultTemplate', () => {
    it('returns viral_shorts_explainer as default', () => {
      const template = getDefaultTemplate();
      expect(template.id).toBe('viral_shorts_explainer');
    });
  });

  describe('Template Type Safety', () => {
    it('TemplateId type restricts to 3 valid values', () => {
      // This test verifies TypeScript type checking at compile time
      const validIds: TemplateId[] = [
        'viral_shorts_explainer',
        'affiliate_product_showcase',
        'daily_news_wisdom',
      ];
      expect(validIds.length).toBe(3);
    });

    it('FirstRunTemplate shape is complete', () => {
      const template = FIRST_RUN_TEMPLATES.viral_shorts_explainer;
      const expectedKeys: (keyof FirstRunTemplate)[] = [
        'id',
        'name',
        'description',
        'badge',
        'durationSeconds',
        'aspectRatio',
        'targetPlatform',
        'targetWordCount',
        'estimatedScenes',
        'defaultTopic',
        'suggestedPrompts',
        'voiceStyle',
        'visualStyle',
        'callToAction',
      ];
      expectedKeys.forEach((key) => {
        expect(template).toHaveProperty(key);
      });
    });
  });
});