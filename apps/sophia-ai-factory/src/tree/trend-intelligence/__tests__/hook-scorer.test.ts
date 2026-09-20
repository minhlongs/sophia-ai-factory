/**
 * Unit Tests: Hook Scoring Engine & 6-Style Classifier
 *
 * Validates:
 * 1. Mathematical weighting: S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta
 * 2. Weight normalization: sum(weights) === 1.00
 * 3. Boundary conditions and score clamping in [0.0, 1.0]
 * 4. Bilingual classification for all 6 canonical hook styles (EN + VI)
 * 5. Default score fallback and explicit style override
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHookScore,
  classifyHookStyle,
  VIRAL_SCORE_WEIGHTS,
  CANONICAL_HOOK_STYLES,
} from '../hook-scorer';

describe('Hook Scorer — Mathematical Engine & Classifier', () => {
  describe('1. Mathematical Rigor & Weight Normalization', () => {
    it('verifies that weight constants sum exactly to 1.00', () => {
      const sum =
        VIRAL_SCORE_WEIGHTS.hook +
        VIRAL_SCORE_WEIGHTS.pacing +
        VIRAL_SCORE_WEIGHTS.retention +
        VIRAL_SCORE_WEIGHTS.cta;
      expect(sum).toBeCloseTo(1.0, 5);
      expect(VIRAL_SCORE_WEIGHTS.hook).toBe(0.4);
      expect(VIRAL_SCORE_WEIGHTS.pacing).toBe(0.25);
      expect(VIRAL_SCORE_WEIGHTS.retention).toBe(0.2);
      expect(VIRAL_SCORE_WEIGHTS.cta).toBe(0.15);
    });

    it('calculates exact weighted score for canonical highlight clip (0.9, 0.8, 0.85, 0.7)', () => {
      // 0.40*0.90 + 0.25*0.80 + 0.20*0.85 + 0.15*0.70
      // = 0.36 + 0.20 + 0.17 + 0.105 = 0.835 -> 0.84
      const result = calculateHookScore({
        hookText: 'Did you know why top brands never run generic ads?',
        scores: {
          hookScore: 0.9,
          pacingScore: 0.8,
          retentionScore: 0.85,
          ctaScore: 0.7,
        },
      });

      expect(result.viralScore).toBe(0.84);
      expect(result.hookScore).toBe(0.9);
      expect(result.pacingScore).toBe(0.8);
      expect(result.retentionScore).toBe(0.85);
      expect(result.ctaScore).toBe(0.7);
      expect(result.detectedHookStyle).toBe('question');
    });

    it('calculates perfect 1.0 and minimum 0.0 scores accurately', () => {
      const perfect = calculateHookScore({
        hookText: 'Top 3 tools',
        scores: { hookScore: 1.0, pacingScore: 1.0, retentionScore: 1.0, ctaScore: 1.0 },
      });
      expect(perfect.viralScore).toBe(1.0);

      const zero = calculateHookScore({
        hookText: 'Zero score',
        scores: { hookScore: 0.0, pacingScore: 0.0, retentionScore: 0.0, ctaScore: 0.0 },
      });
      expect(zero.viralScore).toBe(0.0);
    });

    it('clamps out-of-range scores into [0.0, 1.0]', () => {
      const clamped = calculateHookScore({
        hookText: 'Clamped test',
        scores: { hookScore: 1.5, pacingScore: -0.5, retentionScore: 2.0, ctaScore: -1.0 },
      });
      // Clamped: hook=1.0, pacing=0.0, retention=1.0, cta=0.0
      // 0.4*1 + 0.25*0 + 0.2*1 + 0.15*0 = 0.60
      expect(clamped.hookScore).toBe(1.0);
      expect(clamped.pacingScore).toBe(0.0);
      expect(clamped.retentionScore).toBe(1.0);
      expect(clamped.ctaScore).toBe(0.0);
      expect(clamped.viralScore).toBe(0.6);
    });

    it('uses 0.50 default when component scores are omitted', () => {
      const result = calculateHookScore({
        hookText: 'A simple hook with no explicit scores',
      });
      // 0.4*0.5 + 0.25*0.5 + 0.20*0.5 + 0.15*0.5 = 0.50
      expect(result.viralScore).toBe(0.5);
      expect(result.hookScore).toBe(0.5);
      expect(result.pacingScore).toBe(0.5);
      expect(result.retentionScore).toBe(0.5);
      expect(result.ctaScore).toBe(0.5);
    });

    it('honors explicitly provided hookStyle override', () => {
      const result = calculateHookScore({
        hookText: '3 secrets to success', // Would classify as statistic_reveal
        hookStyle: 'bold_claim',
      });
      expect(result.detectedHookStyle).toBe('bold_claim');
    });
  });

  describe('2. Canonical 6-Style Hook Classification (Bilingual EN/VI)', () => {
    it('verifies all 6 canonical hook styles are defined', () => {
      expect(CANONICAL_HOOK_STYLES).toHaveLength(6);
      expect(CANONICAL_HOOK_STYLES).toEqual([
        'curiosity_gap',
        'bold_claim',
        'problem_agitation',
        'question',
        'story_lead',
        'statistic_reveal',
      ]);
    });

    describe('statistic_reveal classification', () => {
      it('classifies EN percentage and data reveals', () => {
        expect(classifyHookStyle('93% of creators fail because of this 1 mistake')).toBe(
          'statistic_reveal',
        );
        expect(classifyHookStyle('Top 3 AI tools that will save you 10 hours a week')).toBe(
          'statistic_reveal',
        );
        expect(classifyHookStyle('This $0 tool changed how we build apps')).toBe(
          'statistic_reveal',
        );
      });

      it('classifies VI number and quantitative reveals', () => {
        expect(classifyHookStyle('3 bí quyết giúp kênh đạt triệu view trong 30 ngày')).toBe(
          'statistic_reveal',
        );
        expect(classifyHookStyle('Hơn 90% người làm video ngắn không biết mẹo này')).toBe(
          'statistic_reveal',
        );
        expect(classifyHookStyle('5 bước kiếm 100 triệu mỗi tháng với affiliate')).toBe(
          'statistic_reveal',
        );
      });
    });

    describe('question classification', () => {
      it('classifies EN inquiries and direct questions', () => {
        expect(classifyHookStyle('Did you know why top brands never run generic ads?')).toBe(
          'question',
        );
        expect(classifyHookStyle('Why do most startups fail in their first year?')).toBe(
          'question',
        );
        expect(classifyHookStyle('Have you ever wondered how creators make viral hooks?')).toBe(
          'question',
        );
      });

      it('classifies VI questions and inquiries', () => {
        expect(classifyHookStyle('Tại sao 99% người làm video ngắn thất bại?')).toBe(
          'question',
        );
        expect(classifyHookStyle('Làm sao để giữ chân người xem trong 3 giây đầu?')).toBe(
          'question',
        );
        expect(classifyHookStyle('Liệu AI có thể thay thế hoàn toàn marketer?')).toBe(
          'question',
        );
      });
    });

    describe('problem_agitation classification', () => {
      it('classifies EN warnings and critical friction hooks', () => {
        expect(classifyHookStyle('Stop doing this fatal mistake when publishing to TikTok')).toBe(
          'problem_agitation',
        );
        expect(classifyHookStyle("Don't make this mistake when setting up your ad campaign")).toBe(
          'problem_agitation',
        );
        expect(classifyHookStyle('The biggest mistake costing you thousands in sales')).toBe(
          'problem_agitation',
        );
      });

      it('classifies VI warnings and fatal mistakes', () => {
        expect(classifyHookStyle('Sai lầm chết người khiến video của bạn bị bóp tương tác')).toBe(
          'problem_agitation',
        );
        expect(classifyHookStyle('Cảnh báo nguy hiểm khi sử dụng tài khoản TikTok chưa xác minh')).toBe(
          'problem_agitation',
        );
        expect(classifyHookStyle('Đừng bao giờ đăng video vào những khung giờ này')).toBe(
          'problem_agitation',
        );
      });
    });

    describe('bold_claim classification', () => {
      it('classifies EN extreme claims and shocking assertions', () => {
        expect(classifyHookStyle('This AI setup outperforms a 50-person marketing agency')).toBe(
          'bold_claim',
        );
        expect(classifyHookStyle('This mind-blowing strategy will double your revenue overnight')).toBe(
          'bold_claim',
        );
      });

      it('classifies VI bold assertions and disruptive claims', () => {
        expect(classifyHookStyle('Sự thật gây sốc thay đổi hoàn toàn tư duy làm marketing')).toBe(
          'bold_claim',
        );
        expect(classifyHookStyle('Công nghệ AI vượt trội hoàn toàn mọi đối thủ trên thị trường')).toBe(
          'bold_claim',
        );
      });
    });

    describe('story_lead classification', () => {
      it('classifies EN personal narratives and past experiences', () => {
        expect(classifyHookStyle('Last year I lost everything, but this one framework saved me')).toBe(
          'story_lead',
        );
        expect(classifyHookStyle('When I started my first online business, nobody believed in me')).toBe(
          'story_lead',
        );
        expect(classifyHookStyle('Story time: how I went from zero to 100k followers in 6 months')).toBe(
          'story_lead',
        );
      });

      it('classifies VI narratives and personal storytelling', () => {
        expect(classifyHookStyle('Hồi đó khi tôi mới chập chững bước chân vào ngành marketing')).toBe(
          'story_lead',
        );
        expect(classifyHookStyle('Năm ngoái tôi từng mất sạch vốn, nhưng bài học này đã cứu tôi')).toBe(
          'story_lead',
        );
        expect(classifyHookStyle('Câu chuyện thật về hành trình xây dựng kênh triệu view')).toBe(
          'story_lead',
        );
      });
    });

    describe('curiosity_gap classification', () => {
      it('classifies EN suspense and withholding info', () => {
        expect(classifyHookStyle('Wait until the end to see the shocking reveal')).toBe(
          'curiosity_gap',
        );
        expect(classifyHookStyle("The secret nobody tells you about short-form algorithms")).toBe(
          'curiosity_gap',
        );
        expect(classifyHookStyle('Here is why your videos get zero views')).toBe(
          'curiosity_gap',
        );
      });

      it('classifies VI suspense and withholding info', () => {
        expect(classifyHookStyle('Cái kết bất ngờ mà không ai có thể đoán trước được')).toBe(
          'curiosity_gap',
        );
        expect(classifyHookStyle('Điều bí mật đằng sau thuật toán giữ chân người xem')).toBe(
          'curiosity_gap',
        );
        expect(classifyHookStyle('Hãy xem đến cuối để biết lý do thực sự')).toBe(
          'curiosity_gap',
        );
      });

      it('defaults to curiosity_gap on empty or non-matching text', () => {
        expect(classifyHookStyle('')).toBe('curiosity_gap');
        expect(classifyHookStyle('   ')).toBe('curiosity_gap');
        expect(classifyHookStyle('Random text without any trigger words')).toBe(
          'curiosity_gap',
        );
      });
    });
  });

  describe('3. Adversarial Robustness & NaN Input Sanitization', () => {
    it('safely handles NaN in component scores and returns finite viralScore', () => {
      const result = calculateHookScore({
        hookText: 'Did you know why top brands fail?',
        scores: {
          hookScore: NaN,
          pacingScore: NaN,
          retentionScore: 0.8,
          ctaScore: NaN,
        },
      });

      expect(Number.isFinite(result.viralScore)).toBe(true);
      expect(Number.isNaN(result.viralScore)).toBe(false);
      expect(result.hookScore).toBe(0.5); // Fallback applied
      expect(result.pacingScore).toBe(0.5);
      expect(result.retentionScore).toBe(0.8);
      expect(result.ctaScore).toBe(0.5);
      // 0.40*0.5 + 0.25*0.5 + 0.20*0.8 + 0.15*0.5 = 0.20 + 0.125 + 0.16 + 0.075 = 0.56
      expect(result.viralScore).toBe(0.56);
    });

    it('safely handles Infinity and -Infinity without numerical explosion', () => {
      const result = calculateHookScore({
        hookText: 'Top 3 secrets',
        scores: {
          hookScore: Infinity,
          pacingScore: -Infinity,
        },
      });

      expect(Number.isFinite(result.viralScore)).toBe(true);
      expect(result.hookScore).toBe(1.0); // +Infinity clamps to 1.0
      expect(result.pacingScore).toBe(0.0); // -Infinity clamps to 0.0
    });

    it('safely handles null, undefined, and non-string hookText without crashing', () => {
      // @ts-expect-error Testing runtime JS callers passing null
      const nullResult = calculateHookScore({ hookText: null });
      expect(nullResult.detectedHookStyle).toBe('curiosity_gap');
      expect(Number.isFinite(nullResult.viralScore)).toBe(true);

      // @ts-expect-error Testing runtime JS callers passing undefined
      const undefResult = calculateHookScore({ hookText: undefined });
      expect(undefResult.detectedHookStyle).toBe('curiosity_gap');
    });
  });
});
