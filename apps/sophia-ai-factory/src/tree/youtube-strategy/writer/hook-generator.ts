/**
 * @file hook-generator.ts
 * @description Hook, title, introduction, conclusion, and CTA generation for YouTube video scripts
 */

import type { ScriptStrategy, ScriptHook, ScriptIntroduction, ScriptConclusion, ScriptCTA } from './types';
import type { ScriptFormat } from '../script-templates';

export function generateTitle(strategy: ScriptStrategy): string {
  const ct = strategy.contentType;
  if (ct === 'Tutorial') return `How to ${strategy.topic}: Step-by-Step Guide`;
  if (ct === 'List') return `Top 10 ${strategy.topic} Tips You Need to Know`;
  if (ct === 'Review') return `${strategy.topic} Review: Is It Worth It?`;
  return strategy.angle || `${strategy.topic}: The Complete Guide`;
}

export function generateHook(strategy: ScriptStrategy): ScriptHook {
  const hooks: ScriptHook[] = [
    { type: 'question', text: `Have you ever wondered how ${strategy.topic} actually works?`, duration: '0:00-0:05' },
    { type: 'promise', text: `In the next few minutes, you'll learn exactly how to master ${strategy.topic}.`, duration: '0:00-0:05' },
    { type: 'challenge', text: `Most people think they understand ${strategy.topic}, but they're completely wrong.`, duration: '0:00-0:05' },
  ];
  return hooks[Math.floor(Math.random() * hooks.length)];
}

export function generateIntroduction(strategy: ScriptStrategy): ScriptIntroduction {
  const valueProps: Record<string, string> = {
    Tutorial: `how to implement ${strategy.topic} step by step`,
    Explainer: `what ${strategy.topic} is and why it matters`,
    List: `the most important things about ${strategy.topic}`,
    Review: `whether ${strategy.topic} is right for you`,
    Story: `the incredible journey of ${strategy.topic}`,
  };

  return {
    greeting: 'Hey everyone, welcome back to the channel!',
    topicIntro: `Today, we're diving deep into ${strategy.topic}.`,
    valueProposition: `By the end of this video, you'll understand exactly ${valueProps[strategy.contentType] ?? `everything about ${strategy.topic}`}.`,
    credibility: 'Based on the latest research and data',
    duration: '0:05-0:20',
  };
}

export function generateConclusion(strategy: ScriptStrategy): ScriptConclusion {
  return {
    recap: [
      `So that's everything you need to know about ${strategy.topic}.`,
      'We covered the key points:',
      '- The fundamentals and why they matter',
      '- Practical steps to get started',
      '- Tips for long-term success',
    ],
    finalThought: `Remember, ${strategy.topic} is a journey, not a destination. Keep learning!`,
    duration: '30 seconds',
  };
}

export function generateCTA(strategy: ScriptStrategy): ScriptCTA {
  return {
    subscribe: 'If you found this helpful, make sure to subscribe and hit the notification bell!',
    like: 'Give this video a thumbs up if you learned something new.',
    comment: `Let me know in the comments: What's your experience with ${strategy.topic}?`,
    nextVideo: 'Check out this related video for more insights.',
    duration: '15 seconds',
  };
}

export function normalizeFormat(contentType: string): ScriptFormat {
  const allowed: ScriptFormat[] = ['tutorial', 'explainer', 'list', 'review', 'story'];
  const lower = contentType.toLowerCase() as ScriptFormat;
  return allowed.includes(lower) ? lower : 'explainer';
}
