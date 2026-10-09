/**
 * @file content.ts
 * @description Concepts, stories, IPs, projects, assets, and derivative assets.
 * @layer seed
 */

export type ContentStatus = 'draft' | 'planned' | 'in_production' | 'review' | 'approved' | 'published' | 'archived';
export type ContentKind = 'video_short' | 'video_long' | 'image' | 'audio' | 'article' | 'carousel' | 'mixed';

export interface CreativeConcept {
  id: string;
  workspaceId: string;
  missionId?: string;
  title: string;
  hook: string;
  format: ContentKind;
  targetChannel: string[];
  audience: string;
  estimatedDuration?: number;
  tags: string[];
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Story {
  id: string;
  workspaceId: string;
  conceptId?: string;
  title: string;
  synopsis: string;
  characters: string[]; // IP character IDs
  themes: string[];
  arc: string; // narrative arc description
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface IP {
  id: string;
  workspaceId: string;
  type: 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand';
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  parentId?: string;
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ContentProject {
  id: string;
  workspaceId: string;
  missionId?: string;
  conceptId?: string;
  storyId?: string;
  creatorId: string;
  brandId?: string;
  title: string;
  description: string;
  format: ContentKind;
  status: ContentStatus;
  budgetCents: number;
  actualCostCents: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ContentAsset {
  id: string;
  projectId: string;
  workspaceId: string;
  type: 'script' | 'storyboard' | 'audio' | 'video' | 'image' | 'subtitle' | 'thumbnail';
  storageKey?: string; // R2 key if applicable
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status: ContentStatus;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface DerivativeAsset {
  id: string;
  workspaceId: string;
  sourceAssetId: string;
  parentAssetId: string;
  type: 'clip' | 'thumbnail' | 'quote_card' | 'audio_extract' | 'text_extract' | 'remix' | 'translation' | 'summary';
  storageKey?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}
