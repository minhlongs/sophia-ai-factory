import { describe, it, expect } from 'vitest';
import {
  createUserItemMatrix,
  cosineSimilarity,
  findSimilarUsers,
  userBasedCF,
  contentBasedScore,
  contentBasedFiltering,
  hybridScore,
  generateRecommendations,
  SAMPLE_ITEMS,
  SAMPLE_INTERACTIONS
} from './recommendation-engine';

describe('Recommendation Engine', () => {
  describe('createUserItemMatrix', () => {
    it('should create correct matrix from interactions', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);

      expect(matrix['user-1']['template-1']).toBe(5);
      expect(matrix['user-1']['template-3']).toBe(4);
      expect(matrix['user-2']['template-1']).toBe(4);
    });

    it('should handle empty interactions', () => {
      const matrix = createUserItemMatrix([]);
      expect(Object.keys(matrix).length).toBe(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const result = cosineSimilarity([1, 2, 3], [1, 2, 3]);
      expect(result).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const result = cosineSimilarity([1, 0], [0, 1]);
      expect(result).toBeCloseTo(0, 5);
    });

    it('should handle empty vectors', () => {
      expect(cosineSimilarity([], [1, 2, 3])).toBe(0);
    });

    it('should handle different length vectors', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    });
  });

  describe('findSimilarUsers', () => {
    it('should find users with similar ratings', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const similar = findSimilarUsers('user-1', matrix);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].similarity).toBeGreaterThan(0);
      expect(similar[0].userId).not.toBe('user-1');
    });

    it('should respect topK limit', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const similar = findSimilarUsers('user-1', matrix, 2);
      expect(similar.length).toBeLessThanOrEqual(2);
    });
  });

  describe('userBasedCF', () => {
    it('should predict rating for known item', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const score = userBasedCF('user-1', matrix, 'template-2');

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should return 0 for user with no ratings', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const score = userBasedCF('unknown-user', matrix, 'template-1');
      expect(score).toBe(0);
    });
  });

  describe('contentBasedScore', () => {
    it('should score same item as 1.0', () => {
      const item = SAMPLE_ITEMS[0];
      const score = contentBasedScore(item, item);
      expect(score).toBeGreaterThan(0.8);
    });

    it('should score similar items higher than different items', () => {
      const template1 = SAMPLE_ITEMS[0];
      const template3 = SAMPLE_ITEMS[2];
      const template2 = SAMPLE_ITEMS[1];

      const similarScore = contentBasedScore(template1, template3);
      const differentScore = contentBasedScore(template1, template2);

      expect(similarScore).toBeGreaterThan(differentScore);
    });

    it('should respect custom weights', () => {
      const itemA = SAMPLE_ITEMS[0];
      const itemB = SAMPLE_ITEMS[1];

      const score1 = contentBasedScore(itemA, itemB, { features: 0.8, tags: 0.1, category: 0.1 });
      const score2 = contentBasedScore(itemA, itemB, { features: 0.1, tags: 0.1, category: 0.8 });

      expect(score1).not.toBe(score2);
    });
  });

  describe('contentBasedFiltering', () => {
    it('should return top K recommendations', () => {
      const targetItem = SAMPLE_ITEMS[0];
      const recommendations = contentBasedFiltering(targetItem, SAMPLE_ITEMS, 3);

      expect(recommendations.length).toBeLessThanOrEqual(3);
      expect(recommendations.every(r => r.itemId !== targetItem.id)).toBe(true);
    });

    it('should include reasons for each recommendation', () => {
      const targetItem = SAMPLE_ITEMS[0];
      const recommendations = contentBasedFiltering(targetItem, SAMPLE_ITEMS);

      recommendations.forEach(rec => {
        expect(Array.isArray(rec.reasons)).toBe(true);
        expect(rec.reasons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('hybridScore', () => {
    it('should return combined score with breakdown', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const item = SAMPLE_ITEMS[0];

      const result = hybridScore('user-1', item, matrix, SAMPLE_ITEMS, SAMPLE_INTERACTIONS);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.breakdown.collaborative).toBeDefined();
      expect(result.breakdown.content).toBeDefined();
    });

    it('should use content-based only for cold start users', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const item = SAMPLE_ITEMS[0];

      const result = hybridScore('new-user', item, matrix, SAMPLE_ITEMS, [], { minInteractions: 3 });

      expect(result.breakdown.collaborative).toBe(0);
      expect(result.breakdown.content).toBeGreaterThanOrEqual(0);
    });

    it('should respect custom weights', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);
      const item = SAMPLE_ITEMS[0];

      const result1 = hybridScore('user-1', item, matrix, SAMPLE_ITEMS, SAMPLE_INTERACTIONS, {
        collaborativeWeight: 0.9,
        contentWeight: 0.1
      });

      const result2 = hybridScore('user-1', item, matrix, SAMPLE_ITEMS, SAMPLE_INTERACTIONS, {
        collaborativeWeight: 0.1,
        contentWeight: 0.9
      });

      expect(result1.breakdown.collaborative).not.toBe(result2.breakdown.collaborative);
    });
  });

  describe('generateRecommendations', () => {
    it('should return top K unseen items', () => {
      const recommendations = generateRecommendations('user-1', SAMPLE_ITEMS, SAMPLE_INTERACTIONS, {}, 3);

      expect(recommendations.length).toBeLessThanOrEqual(3);

      const seenItems = SAMPLE_INTERACTIONS
        .filter(i => i.userId === 'user-1')
        .map(i => i.itemId);

      recommendations.forEach(rec => {
        expect(seenItems).not.toContain(rec.itemId);
      });
    });

    it('should include reasons for each recommendation', () => {
      const recommendations = generateRecommendations('user-1', SAMPLE_ITEMS, SAMPLE_INTERACTIONS);

      recommendations.forEach(rec => {
        expect(Array.isArray(rec.reasons)).toBe(true);
        expect(rec.reasons.length).toBeGreaterThan(0);
      });
    });

    it('should sort by score descending', () => {
      const recommendations = generateRecommendations('user-1', SAMPLE_ITEMS, SAMPLE_INTERACTIONS);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].score).toBeLessThanOrEqual(recommendations[i - 1].score);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete recommendation flow', () => {
      const matrix = createUserItemMatrix(SAMPLE_INTERACTIONS);

      expect(Object.keys(matrix).length).toBe(4);

      const similar = findSimilarUsers('user-1', matrix);
      expect(similar.length).toBeGreaterThan(0);

      const recommendations = generateRecommendations('user-1', SAMPLE_ITEMS, SAMPLE_INTERACTIONS);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].score).toBeGreaterThan(0);
    });

    it('should handle edge case: single interaction', () => {
      const singleInteraction = [SAMPLE_INTERACTIONS[0]];
      const recommendations = generateRecommendations('user-1', SAMPLE_ITEMS, singleInteraction);

      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle edge case: all items rated', () => {
      const allRatedInteractions: typeof SAMPLE_INTERACTIONS = [
        ...SAMPLE_INTERACTIONS,
        { userId: 'user-1', itemId: 'template-2', rating: 4, timestamp: Date.now() },
        { userId: 'user-1', itemId: 'template-4', rating: 3, timestamp: Date.now() },
        { userId: 'user-1', itemId: 'template-5', rating: 5, timestamp: Date.now() }
      ];

      const recommendations = generateRecommendations('user-1', SAMPLE_ITEMS, allRatedInteractions);
      expect(recommendations.length).toBe(0);
    });
  });
});
