/**
 * Recommendation Engine - Hybrid Collaborative + Content-Based Filtering
 *
 * Algorithms: User-based CF, Item-based CF, Content-based matching, Hybrid scoring
 * Domain: Sophia AI Video Factory - template & asset recommendations
 */

export interface User {
  id: string;
  preferences?: string[];
  demographic?: Record<string, string>;
}

export interface Item {
  id: string;
  features: Record<string, number>;
  tags: string[];
  category: string;
}

export interface Interaction {
  userId: string;
  itemId: string;
  rating: number;
  timestamp: number;
}

export interface Recommendation {
  itemId: string;
  score: number;
  reasons: string[];
}

export interface UserItemMatrix {
  [userId: string]: { [itemId: string]: number };
}

// ==================== Collaborative Filtering ====================

export function createUserItemMatrix(interactions: Interaction[]): UserItemMatrix {
  const matrix: UserItemMatrix = {};

  for (const interaction of interactions) {
    if (!matrix[interaction.userId]) {
      matrix[interaction.userId] = {};
    }
    matrix[interaction.userId][interaction.itemId] = interaction.rating;
  }

  return matrix;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function findSimilarUsers(
  targetUserId: string,
  matrix: UserItemMatrix,
  topK: number = 5
): Array<{ userId: string; similarity: number }> {
  const targetRatings = matrix[targetUserId];
  if (!targetRatings) return [];

  const targetItems = Object.keys(targetRatings);
  const similarities: Array<{ userId: string; similarity: number }> = [];

  for (const [userId, ratings] of Object.entries(matrix)) {
    if (userId === targetUserId) continue;

    const commonItems = targetItems.filter(item => item in ratings);
    // Lowered threshold from 2 to 1 to handle sparse matrices
    if (commonItems.length < 1) continue;

    // Build vectors only for common items to ensure meaningful comparison
    const vecA = commonItems.map(item => targetRatings[item] || 0);
    const vecB = commonItems.map(item => ratings[item] || 0);

    const similarity = cosineSimilarity(vecA, vecB);
    if (similarity > 0) {
      similarities.push({ userId, similarity });
    }
  }

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}

export function userBasedCF(
  targetUserId: string,
  matrix: UserItemMatrix,
  itemId: string
): number {
  const similarUsers = findSimilarUsers(targetUserId, matrix);
  if (similarUsers.length === 0) return 0;

  let weightedSum = 0;
  let similaritySum = 0;

  for (const { userId, similarity } of similarUsers) {
    const rating = matrix[userId][itemId];
    if (rating !== undefined) {
      weightedSum += similarity * rating;
      similaritySum += Math.abs(similarity);
    }
  }

  return similaritySum > 0 ? weightedSum / similaritySum : 0;
}

export function itemBasedCF(
  targetUserId: string,
  matrix: UserItemMatrix,
  targetItemId: string,
  itemFeatures: Record<string, number[]>
): number {
  const userRatings = matrix[targetUserId];
  if (!userRatings) return 0;

  const targetVec = itemFeatures[targetItemId] || [];
  let weightedSum = 0;
  let similaritySum = 0;

  for (const [itemId, rating] of Object.entries(userRatings)) {
    if (itemId === targetItemId) continue;

    const itemVec = itemFeatures[itemId] || [];
    const similarity = cosineSimilarity(targetVec, itemVec);

    if (similarity > 0) {
      weightedSum += similarity * rating;
      similaritySum += Math.abs(similarity);
    }
  }

  return similaritySum > 0 ? weightedSum / similaritySum : 0;
}

// ==================== Content-Based Filtering ====================

export function calculateFeatureSimilarity(
  itemA: Item,
  itemB: Item
): number {
  const allFeatures = new Set([
    ...Object.keys(itemA.features),
    ...Object.keys(itemB.features)
  ]);

  const vecA: number[] = [];
  const vecB: number[] = [];

  for (const feature of allFeatures) {
    vecA.push(itemA.features[feature] || 0);
    vecB.push(itemB.features[feature] || 0);
  }

  return cosineSimilarity(vecA, vecB);
}

export function calculateTagOverlap(itemA: Item, itemB: Item): number {
  if (itemA.tags.length === 0 || itemB.tags.length === 0) return 0;

  const setA = new Set(itemA.tags);
  const setB = new Set(itemB.tags);

  const intersection = [...setA].filter(tag => setB.has(tag)).length;
  const union = new Set([...itemA.tags, ...itemB.tags]).size;

  return union > 0 ? intersection / union : 0;
}

export function contentBasedScore(
  targetItem: Item,
  candidateItem: Item,
  weights: { features?: number; tags?: number; category?: number } = {}
): number {
  const featureWeight = weights.features ?? 0.5;
  const tagWeight = weights.tags ?? 0.3;
  const categoryWeight = weights.category ?? 0.2;

  const featureScore = calculateFeatureSimilarity(targetItem, candidateItem);
  const tagScore = calculateTagOverlap(targetItem, candidateItem);
  const categoryScore = targetItem.category === candidateItem.category ? 1 : 0;

  return (featureScore * featureWeight) +
         (tagScore * tagWeight) +
         (categoryScore * categoryWeight);
}

export function contentBasedFiltering(
  targetItem: Item,
  candidates: Item[],
  topK: number = 10
): Recommendation[] {
  const scored = candidates
    .filter(item => item.id !== targetItem.id)
    .map(item => ({
      itemId: item.id,
      score: contentBasedScore(targetItem, item),
      reasons: generateContentReasons(targetItem, item)
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

// ==================== Hybrid Scoring ====================

export interface HybridConfig {
  collaborativeWeight?: number;
  contentWeight?: number;
  minInteractions?: number;
}

export function hybridScore(
  userId: string,
  item: Item,
  matrix: UserItemMatrix,
  allItems: Item[],
  userInteractions: Interaction[],
  config: HybridConfig = {}
): { score: number; breakdown: { collaborative: number; content: number } } {
  const cfWeight = config.collaborativeWeight ?? 0.6;
  const cbWeight = config.contentWeight ?? 0.4;
  // Lower default to 2 to enable CF for users with minimal history
  const minInteractions = config.minInteractions ?? 2;

  const userItemIds = new Set(
    userInteractions
      .filter(i => i.userId === userId)
      .map(i => i.itemId)
  );

  if (userItemIds.size < minInteractions) {
    const contentItem = allItems.find(i => i.id === item.id);
    if (!contentItem) {
      return { score: 0, breakdown: { collaborative: 0, content: 0 } };
    }

    const userPreferences = getUserPreferences(userId, userInteractions, allItems);
    const contentScore = contentBasedScore(userPreferences, contentItem);

    return {
      score: contentScore,
      breakdown: { collaborative: 0, content: contentScore }
    };
  }

  // Calculate collaborative filtering score
  const cfScore = userBasedCF(userId, matrix, item.id);

  // Calculate content-based score from highly-rated items
  const ratedItems = userInteractions
    .filter(i => i.userId === userId)
    .map(i => allItems.find(it => it.id === i.itemId))
    .filter((i): i is Item => i !== undefined);

  let contentScore = 0;
  if (ratedItems.length > 0) {
    const userRatings = userInteractions.filter(i => i.userId === userId);
    const avgRating = userRatings.reduce((sum, i) => sum + i.rating, 0) / userRatings.length;

    const highlyRated = ratedItems.filter(i => {
      const rating = userInteractions.find(r => r.userId === userId && r.itemId === i.id)?.rating ?? 0;
      return rating >= avgRating;
    });

    if (highlyRated.length > 0) {
      contentScore = Math.max(
        ...highlyRated.map(rated => contentBasedScore(rated, item))
      );
    }
  }

  // Normalize scores: CF is 0-5, content is 0-1
  const normalizedCf = cfScore / 5;
  const normalizedCb = contentScore;

  // Apply weights
  const finalScore = (normalizedCf * cfWeight) + (normalizedCb * cbWeight);

  return {
    score: finalScore,
    breakdown: {
      collaborative: normalizedCf * cfWeight,
      content: normalizedCb * cbWeight
    }
  };
}

// ==================== Helper Functions ====================

export function getUserPreferences(
  userId: string,
  interactions: Interaction[],
  allItems: Item[]
): Item {
  const userRatings = interactions
    .filter(i => i.userId === userId)
    .reduce((acc, i) => {
      acc[i.itemId] = i.rating;
      return acc;
    }, {} as Record<string, number>);

  const itemIds = Object.keys(userRatings);
  if (itemIds.length === 0) {
    return { id: '', features: {}, tags: [], category: '' };
  }

  const ratedItems = allItems.filter(item => itemIds.includes(item.id));
  if (ratedItems.length === 0) {
    return { id: '', features: {}, tags: [], category: '' };
  }

  const totalRating = itemIds.reduce((sum, id) => sum + (userRatings[id] || 0), 0);

  const aggregatedFeatures: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const item of ratedItems) {
    const weight = userRatings[item.id] / totalRating;

    for (const [feature, value] of Object.entries(item.features)) {
      aggregatedFeatures[feature] = (aggregatedFeatures[feature] || 0) + (value * weight);
    }

    for (const tag of item.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + weight;
    }

    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + weight;
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const topCategory = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  return {
    id: `user-${userId}-profile`,
    features: aggregatedFeatures,
    tags: topTags,
    category: topCategory
  };
}

export function generateContentReasons(targetItem: Item, recommendedItem: Item): string[] {
  const reasons: string[] = [];

  if (targetItem.category === recommendedItem.category) {
    reasons.push(`Same category: ${targetItem.category}`);
  }

  const commonTags = targetItem.tags.filter(tag => recommendedItem.tags.includes(tag));
  if (commonTags.length > 0) {
    reasons.push(`Similar tags: ${commonTags.slice(0, 3).join(', ')}`);
  }

  const featureDiff = Object.entries(targetItem.features)
    .map(([key, value]) => ({
      key,
      diff: Math.abs(value - (recommendedItem.features[key] || 0))
    }))
    .filter(f => f.diff < 0.3);

  if (featureDiff.length > 0) {
    reasons.push(`Similar ${featureDiff.length} characteristics`);
  }

  return reasons.slice(0, 3);
}

export function generateRecommendations(
  userId: string,
  items: Item[],
  interactions: Interaction[],
  config: HybridConfig = {},
  topK: number = 10
): Recommendation[] {
  const matrix = createUserItemMatrix(interactions);
  const userInteractionSet = new Set(
    interactions
      .filter(i => i.userId === userId)
      .map(i => i.itemId)
  );

  const unseenItems = items.filter(item => !userInteractionSet.has(item.id));

  const scored = unseenItems
    .map(item => {
      const { score, breakdown } = hybridScore(
        userId,
        item,
        matrix,
        items,
        interactions,
        config
      );

      const userPrefs = getUserPreferences(userId, interactions, items);
      const reasons = generateContentReasons(userPrefs, item);

      if (breakdown.collaborative > 0.7) {
        reasons.push('Popular with similar users');
      }

      return {
        itemId: item.id,
        score,
        reasons: reasons.slice(0, 3)
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

// ==================== Sample Data ====================

export const SAMPLE_ITEMS: Item[] = [
  {
    id: 'template-1',
    features: { duration: 0.8, complexity: 0.6, style: 0.9, engagement: 0.7 },
    tags: ['marketing', 'social-media', 'product'],
    category: 'marketing'
  },
  {
    id: 'template-2',
    features: { duration: 0.3, complexity: 0.4, style: 0.5, engagement: 0.8 },
    tags: ['tutorial', 'education', 'screen-record'],
    category: 'education'
  },
  {
    id: 'template-3',
    features: { duration: 0.6, complexity: 0.7, style: 0.8, engagement: 0.6 },
    tags: ['promo', 'product', 'showcase'],
    category: 'marketing'
  },
  {
    id: 'template-4',
    features: { duration: 0.5, complexity: 0.5, style: 0.6, engagement: 0.7 },
    tags: ['explainer', 'animation', 'education'],
    category: 'education'
  },
  {
    id: 'template-5',
    features: { duration: 0.9, complexity: 0.8, style: 0.7, engagement: 0.9 },
    tags: ['demo', 'product', 'tutorial'],
    category: 'product-demo'
  }
];

export const SAMPLE_INTERACTIONS: Interaction[] = [
  { userId: 'user-1', itemId: 'template-1', rating: 5, timestamp: Date.now() - 86400000 },
  { userId: 'user-1', itemId: 'template-3', rating: 4, timestamp: Date.now() - 172800000 },
  { userId: 'user-2', itemId: 'template-1', rating: 4, timestamp: Date.now() - 259200000 },
  { userId: 'user-2', itemId: 'template-2', rating: 5, timestamp: Date.now() - 345600000 },
  { userId: 'user-3', itemId: 'template-3', rating: 5, timestamp: Date.now() - 432000000 },
  { userId: 'user-3', itemId: 'template-4', rating: 3, timestamp: Date.now() - 518400000 },
  { userId: 'user-4', itemId: 'template-2', rating: 4, timestamp: Date.now() - 604800000 },
  { userId: 'user-4', itemId: 'template-5', rating: 5, timestamp: Date.now() - 691200000 }
];

export const SAMPLE_USER: User = {
  id: 'user-1',
  preferences: ['marketing', 'product'],
  demographic: { industry: 'retail', size: 'SMB' }
};

export default {
  createUserItemMatrix,
  cosineSimilarity,
  findSimilarUsers,
  userBasedCF,
  itemBasedCF,
  calculateFeatureSimilarity,
  calculateTagOverlap,
  contentBasedScore,
  contentBasedFiltering,
  hybridScore,
  generateRecommendations,
  getUserPreferences,
  generateContentReasons,
  SAMPLE_ITEMS,
  SAMPLE_INTERACTIONS,
  SAMPLE_USER
};
