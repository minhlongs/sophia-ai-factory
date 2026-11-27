/**
 * Comment-to-DM Keyword Trigger FSM & Anti-Spam Reply Pacing.
 *
 * Clean-room pure-TS engine (MIT patterns from diwennee/openreply,
 * jasonc00person/fewchat, CharanMN7/ig-comment-dm, and Meta 750/hr limits):
 * - Diacritic-normalized Vietnamese/English keyword trigger matching.
 * - Enforces Meta's 750 private replies/hour cap and 24-hour messaging window.
 *
 * Layer: seed/growth (pure deterministic FSM, zero external deps)
 *
 * @module seed/growth/comment-to-dm-fsm
 */

export type CommentDmState = 'IGNORED' | 'QUEUED_FOR_DM' | 'DEFERRED_RATE_LIMIT' | 'EXPIRED_24H';

export interface CommentTriggerInput {
  readonly commentText: string;
  readonly keywords: readonly string[];
  readonly repliesSentLastHour: number;
  readonly hoursSinceComment: number;
}

export interface CommentTriggerDecision {
  readonly state: CommentDmState;
  readonly matchedKeyword: string | null;
  readonly reason: string;
}

const META_HOURLY_PRIVATE_REPLY_CAP = 750;
const META_MESSAGING_WINDOW_HOURS = 24;

function normalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

export function evaluateCommentToDmTrigger(input: CommentTriggerInput): CommentTriggerDecision {
  const haystack = normalizeText(input.commentText);
  const matched = input.keywords.find((kw) => {
    const clean = normalizeText(kw);
    return clean.length > 0 && haystack.includes(clean);
  });

  if (!matched) {
    return { state: 'IGNORED', matchedKeyword: null, reason: 'No trigger keyword matched' };
  }
  if (
    !Number.isFinite(input.hoursSinceComment) ||
    input.hoursSinceComment < 0 ||
    input.hoursSinceComment > META_MESSAGING_WINDOW_HOURS
  ) {
    return { state: 'EXPIRED_24H', matchedKeyword: matched, reason: 'Outside Meta 24-hour messaging window' };
  }
  if (
    !Number.isFinite(input.repliesSentLastHour) ||
    input.repliesSentLastHour < 0 ||
    input.repliesSentLastHour >= META_HOURLY_PRIVATE_REPLY_CAP
  ) {
    return { state: 'DEFERRED_RATE_LIMIT', matchedKeyword: matched, reason: 'Reached 750/hr private-reply cap; queued for next hour' };
  }

  return {
    state: 'QUEUED_FOR_DM',
    matchedKeyword: matched,
    reason: `Matched keyword "${matched}" within 24h window & rate budget`,
  };
}
