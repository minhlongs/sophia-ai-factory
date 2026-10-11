import type {
  CreatorMemoryDbRow,
  CreatorMemoryType,
  CreatorProfile,
} from '@/seed/db/types';

export type {
  CreatorMemoryDbRow,
  CreatorMemoryType,
  CreatorProfile,
};

export interface AddMemoryParams {
  userId: string;
  memoryType: CreatorMemoryType;
  category: string;
  contentJson: string;
  relevanceScore?: number;
  sourceExecutionId?: string;
  expiresAt?: number;
}

export interface GetRelevantMemoriesOpts {
  memoryType?: CreatorMemoryType;
  category?: string;
  limit?: number;
}
