/**
 * @file comment-intent-matcher.test.ts
 * @description Unit tests for Comment Purchase Intent Detector
 */

import { describe, it, expect } from 'vitest';
import { matchCommentIntent } from '@/tree/dm-funnel/comment-intent-matcher';

describe('CommentIntentMatcher', () => {
  it('detects inbox intent keyword', () => {
    const match = matchCommentIntent('Shop ơi ib mình mẫu này với');
    expect(match.isIntentDetected).toBe(true);
    expect(match.matchedKeyword).toBe('inbox');
    expect(match.priorityScore).toBe(95);
  });

  it('detects price inquiry keyword', () => {
    const match = matchCommentIntent('Xin giá bao nhiêu tiền vậy bạn?');
    expect(match.isIntentDetected).toBe(true);
    expect(match.matchedKeyword).toBe('price');
    expect(match.priorityScore).toBe(85);
  });

  it('detects link inquiry keyword', () => {
    const match = matchCommentIntent('Cho mình xin link mua nhé');
    expect(match.isIntentDetected).toBe(true);
    expect(match.matchedKeyword).toBe('link');
    expect(match.priorityScore).toBe(90);
  });

  it('ignores casual comments without purchase intent', () => {
    const match = matchCommentIntent('Video hay quá bạn ơi ❤️');
    expect(match.isIntentDetected).toBe(false);
    expect(match.matchedKeyword).toBeNull();
  });
});
