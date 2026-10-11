/**
 * YouTube Source Types & Constants
 * Layer: tree (domain reusable)
 */

import type { MarketSignal } from '@/seed/types/creative-domain';

export interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    categoryId: string;
    tags?: string[];
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export interface YouTubeSearchResponse {
  items?: YouTubeVideoItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface YouTubeCategoriesResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
    };
  }>;
}

export interface YouTubeSourceConfig {
  workspaceId: string;
  userId: string;
  regionCode?: string;
  categoryId?: string;
  maxSignals?: number;
}

export interface SourceResult {
  signals: MarketSignal[];
  blockedReason?: string;
}

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
export const MAX_RESULTS = 25;
export const REGION_CODES = ['US', 'VN', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'BR', 'IN', 'MX'];

export const YOUTUBE_CATEGORY_NAMES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '18': 'Short Movies',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '21': 'Videoblogging',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
  '30': 'Movies',
  '31': 'Anime/Animation',
  '32': 'Action/Adventure',
  '33': 'Classics',
  '34': 'Comedy',
  '35': 'Documentary',
  '36': 'Drama',
  '37': 'Family',
  '38': 'Foreign',
  '39': 'Horror',
  '40': 'Sci-Fi/Fantasy',
  '41': 'Thriller',
  '42': 'Shorts',
  '43': 'Shows',
  '44': 'Trailers',
};
