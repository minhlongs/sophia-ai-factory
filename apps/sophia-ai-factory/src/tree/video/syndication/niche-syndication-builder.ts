/**
 * Niche Syndication Builder
 *
 * Assembles platform-specific posting metadata (YouTube Shorts, TikTok,
 * Instagram Reels) for high-converting SaaS & Crypto affiliate video campaigns.
 *
 * Layer: tree/video/syndication (Domain Reusable Logic)
 * @module tree/video/syndication/niche-syndication-builder
 */

import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type {
  NicheSyndicationPackage,
  SocialPostPayload,
} from './niche-syndication-types';
import { generatePinnedComment } from './pinned-comment-generator';

const SAAS_HASHTAGS = ['#saas', '#ai', '#software', '#productivity', '#techtools', '#automation'];
const CRYPTO_HASHTAGS = ['#crypto', '#bitcoin', '#trading', '#cryptotrading', '#defi', '#web3'];

function buildYoutubeShortsPayload(
  plan: NicheVideoCampaignPlan,
  isCrypto: boolean,
  locale: 'en' | 'vi',
): SocialPostPayload {
  const hashtags = isCrypto
    ? ['#Shorts', '#Crypto', '#TradingBonus', ...CRYPTO_HASHTAGS]
    : ['#Shorts', '#AI', '#SaaS', ...SAAS_HASHTAGS];

  const title = `${plan.productName} Review (Must-Watch) #Shorts`;
  const description = [
    `${plan.productName} - Full workflow & feature breakdown.`,
    `🔗 Exclusive Link: ${plan.trackedUrl}`,
    '',
    plan.caption,
    '',
    hashtags.join(' '),
  ].join('\n');

  const pinnedComment = generatePinnedComment({
    productName: plan.productName,
    trackedUrl: plan.trackedUrl,
    niche: isCrypto ? 'crypto_global' : 'saas_global',
    locale,
  });

  return {
    platform: 'youtube_shorts',
    title,
    caption: title,
    description,
    hashtags,
    trackedUrl: plan.trackedUrl,
    pinnedComment,
    optimalPostingTimesUtc: ['14:00', '18:00', '22:00'],
  };
}

function buildTiktokPayload(
  plan: NicheVideoCampaignPlan,
  isCrypto: boolean,
  locale: 'en' | 'vi',
): SocialPostPayload {
  const hashtags = isCrypto
    ? ['#fyp', '#crypto', '#tradingtips', '#cryptotok']
    : ['#fyp', '#aitools', '#worksmart', '#saastok'];

  const caption = `${plan.productName} demo! Link in bio for bonus ${hashtags.join(' ')}`;

  const pinnedComment = generatePinnedComment({
    productName: plan.productName,
    trackedUrl: plan.trackedUrl,
    niche: isCrypto ? 'crypto_global' : 'saas_global',
    locale,
  });

  return {
    platform: 'tiktok',
    title: `${plan.productName} 60s Demo`,
    caption,
    hashtags,
    trackedUrl: plan.trackedUrl,
    pinnedComment,
    soundRecommendation: 'Trending Lo-Fi Tech Beat (Instrumental)',
    optimalPostingTimesUtc: ['12:00', '17:00', '21:00'],
  };
}

function buildInstagramPayload(
  plan: NicheVideoCampaignPlan,
  isCrypto: boolean,
  locale: 'en' | 'vi',
): SocialPostPayload {
  const hashtags = isCrypto
    ? ['#reels', '#cryptocurrency', '#investing', '#fintech']
    : ['#reels', '#automation', '#entrepreneurship', '#productivitytools'];

  const caption = [
    `Save this for later! 📌 Here is how ${plan.productName} changes the game.`,
    '🔗 Link in Bio & Pinned Comment to get exclusive access perks.',
    '',
    plan.caption,
    '',
    hashtags.join(' '),
  ].join('\n');

  const pinnedComment = generatePinnedComment({
    productName: plan.productName,
    trackedUrl: plan.trackedUrl,
    niche: isCrypto ? 'crypto_global' : 'saas_global',
    locale,
  });

  return {
    platform: 'instagram_reels',
    title: `${plan.productName} Reel`,
    caption,
    hashtags,
    trackedUrl: plan.trackedUrl,
    pinnedComment,
    soundRecommendation: 'Original Audio or Ambient Motivational',
    optimalPostingTimesUtc: ['13:00', '19:00', '23:00'],
  };
}

export function buildNicheSyndicationPackage(
  plan: NicheVideoCampaignPlan,
  locale: 'en' | 'vi' = 'en',
): NicheSyndicationPackage {
  const isCrypto = plan.blueprint.niche === 'crypto_global';
  const niche = isCrypto ? 'crypto_global' : 'saas_global';

  return {
    planId: plan.planId,
    productName: plan.productName,
    niche,
    generatedAt: new Date().toISOString(),
    platforms: {
      youtube_shorts: buildYoutubeShortsPayload(plan, isCrypto, locale),
      tiktok: buildTiktokPayload(plan, isCrypto, locale),
      instagram_reels: buildInstagramPayload(plan, isCrypto, locale),
    },
  };
}
