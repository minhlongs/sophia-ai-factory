/**
 * @module seed/ai/conversation-summarizer
 *
 * Deterministic conversation summarization — no LLM calls.
 *
 * Compresses message history into a system-message-style summary
 * using extractive techniques: key user messages, assistant responses,
 * and detected topics/decisions/action items.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Structured summary of a conversation.
 */
export interface ConversationSummary {
  /** System-message-style summary text. */
  summary: string;
  /** Detected topics from the conversation. */
  topics: string[];
  /** Key decisions made during the conversation. */
  decisions: string[];
  /** User preferences mentioned. */
  userPreferences: string[];
  /** Action items identified. */
  actionItems: string[];
  /** Approximate token count of the summary. */
  estimatedTokens: number;
  /** Number of messages summarized. */
  messagesSummarized: number;
}

// ── ConversationSummarizer ────────────────────────────────────────────────────

/**
 * Deterministic conversation summarizer.
 *
 * Uses extractive techniques to compress message history into a
 * concise summary. No network calls — pure computation.
 */
export class ConversationSummarizer {
  private readonly maxSummaryTokens: number;

  /**
   * @param maxSummaryTokens — Maximum tokens for the generated summary.
   */
  constructor(maxSummaryTokens = 500) {
    this.maxSummaryTokens = maxSummaryTokens;
    logger.info('[ConversationSummarizer] Initialized', undefined, {
      maxSummaryTokens,
    });
  }

  // ── Key point extraction ────────────────────────────────────────────────────

  /**
   * Extract key points from a message array.
   *
   * Identifies topics, decisions, preferences, and action items
   * using pattern matching on message content.
   *
   * @param messages — Chat messages to analyze.
   * @returns Extracted key points.
   */
  extractKeyPoints(messages: ChatMessage[]): {
    topics: string[];
    decisions: string[];
    userPreferences: string[];
    actionItems: string[];
  } {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const topics = this.extractTopics(userMessages);
    const decisions = this.extractDecisions(messages);
    const userPreferences = this.extractPreferences(userMessages);
    const actionItems = this.extractActionItems(messages);

    return { topics, decisions, userPreferences, actionItems };
  }

  /**
   * Summarize a message history into a system-message-style summary.
   *
   * The summary preserves topic, key decisions, user preferences,
   * and action items in a compact format suitable for injection
   * as a system message.
   *
   * @param messages — Chat messages to summarize.
   * @param maxTokens — Optional override for max summary tokens.
   * @returns Structured conversation summary.
   */
  summarize(messages: ChatMessage[], maxTokens?: number): ConversationSummary {
    const effectiveMax = maxTokens ?? this.maxSummaryTokens;
    const keyPoints = this.extractKeyPoints(messages);

    // Build the summary text in system-message style.
    const parts: string[] = [];

    if (keyPoints.topics.length > 0) {
      parts.push(`Topics discussed: ${keyPoints.topics.join(', ')}.`);
    }

    if (keyPoints.decisions.length > 0) {
      parts.push(
        `Key decisions: ${keyPoints.decisions.map((d) => `- ${d}`).join(' ')}`,
      );
    }

    if (keyPoints.userPreferences.length > 0) {
      parts.push(
        `User preferences: ${keyPoints.userPreferences.map((p) => `- ${p}`).join(' ')}`,
      );
    }

    if (keyPoints.actionItems.length > 0) {
      parts.push(
        `Action items: ${keyPoints.actionItems.map((a) => `- ${a}`).join(' ')}`,
      );
    }

    // Fallback: if no structured points found, compress the last few messages.
    let summaryText: string;
    if (parts.length === 0) {
      summaryText = this.compressMessages(messages, effectiveMax);
    } else {
      summaryText = parts.join(' ');
      // Truncate if over budget.
      summaryText = this.truncateToTokenBudget(summaryText, effectiveMax);
    }

    return {
      summary: summaryText,
      topics: keyPoints.topics,
      decisions: keyPoints.decisions,
      userPreferences: keyPoints.userPreferences,
      actionItems: keyPoints.actionItems,
      estimatedTokens: this.estimateTokens(summaryText),
      messagesSummarized: messages.length,
    };
  }

  // ── Topic extraction ────────────────────────────────────────────────────────

  /**
   * Extract conversation topics from user messages.
   *
   * Uses keyword frequency and sentence position to identify
   * the main subjects discussed.
   */
  private extractTopics(userMessages: ChatMessage[]): string[] {
    if (userMessages.length === 0) return [];

    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'need',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'out',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'because',
      'but',
      'and',
      'or',
      'if',
      'while',
      'about',
      'up',
      'it',
      'its',
      'this',
      'that',
      'these',
      'those',
      'i',
      'me',
      'my',
      'we',
      'our',
      'you',
      'your',
      'he',
      'him',
      'his',
      'she',
      'her',
      'they',
      'them',
      'their',
      'what',
      'which',
      'who',
      'whom',
    ]);

    // Collect meaningful words from user messages.
    const wordFreq: Map<string, number> = new Map();
    const wordPositions: Map<string, number> = new Map();

    for (const msg of userMessages) {
      const words = msg.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
        // Earlier messages get lower position score (more important).
        const posScore = userMessages.length - i;
        const existing = wordPositions.get(w) ?? 0;
        wordPositions.set(w, existing + posScore);
      }
    }

    // Score words: frequency * position weight.
    const scored = Array.from(wordFreq.entries()).map(([word, freq]) => ({
      word,
      score: freq * (wordPositions.get(word) ?? 1),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Return top topics (deduplicate similar words by prefix).
    const topics: string[] = [];
    const usedPrefixes = new Set<string>();

    for (const entry of scored) {
      const prefix = entry.word.slice(0, 4);
      if (!usedPrefixes.has(prefix) && topics.length < 5) {
        topics.push(entry.word);
        usedPrefixes.add(prefix);
      }
    }

    return topics;
  }

  // ── Decision extraction ─────────────────────────────────────────────────────

  /**
   * Extract key decisions from the conversation.
   *
   * Looks for decision markers in both user and assistant messages.
   */
  private extractDecisions(messages: ChatMessage[]): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
      /(?:we'll|we will|let's|going with|chosen|selected|decided|agreed|confirmed|finalized)\s+(.+?)(?:\.|$)/i,
      /(?:decision|chose|picked|settled on)\s+(?:is|:)?\s*(.+?)(?:\.|$)/i,
      /(?:i want|i need|i prefer|i'd like)\s+(.+?)(?:\.|$)/i,
    ];

    for (const msg of messages) {
      for (const pattern of decisionPatterns) {
        const matches = msg.content.matchAll(pattern);
        for (const m of matches) {
          const decision = m[1]?.trim();
          if (decision && decision.length > 3 && decision.length < 120) {
            decisions.push(decision);
          }
        }
      }
    }

    // Deduplicate and limit.
    return [...new Set(decisions)].slice(0, 5);
  }

  // ── Preference extraction ───────────────────────────────────────────────────

  /**
   * Extract user preferences from user messages.
   *
   * Looks for preference markers like "I like", "I prefer", "I don't want".
   */
  private extractPreferences(userMessages: ChatMessage[]): string[] {
    const preferences: string[] = [];
    const prefPatterns = [
      /(?:i (?:like|love|prefer|want|need|enjoy|hate|dislike|don't want|do not want))\s+(.+?)(?:\.|$)/i,
      /(?:my (?:favorite|preference|style|choice|pick))\s+(?:is|:)?\s*(.+?)(?:\.|$)/i,
      /(?:make it|keep it|use|go with)\s+(.+?)(?:\.|$)/i,
    ];

    for (const msg of userMessages) {
      for (const pattern of prefPatterns) {
        const matches = msg.content.matchAll(pattern);
        for (const m of matches) {
          const pref = m[1]?.trim();
          if (pref && pref.length > 2 && pref.length < 100) {
            preferences.push(pref);
          }
        }
      }
    }

    return [...new Set(preferences)].slice(0, 5);
  }

  // ── Action item extraction ──────────────────────────────────────────────────

  /**
   * Extract action items from the conversation.
   *
   * Looks for task markers, todos, and next-step indicators.
   */
  private extractActionItems(messages: ChatMessage[]): string[] {
    const actionItems: string[] = [];
    const actionPatterns = [
      /(?:todo|to-do|task|action item|next step|follow up|follow-up)[\s:]+(.+?)(?:\.|$)/i,
      /(?:need to|must|should|have to|going to)\s+(.+?)(?:\.|$)/i,
      /(?:remind me|don't forget|make sure)\s+(?:to\s+)?(.+?)(?:\.|$)/i,
    ];

    for (const msg of messages) {
      for (const pattern of actionPatterns) {
        const matches = msg.content.matchAll(pattern);
        for (const m of matches) {
          const item = m[1]?.trim();
          if (item && item.length > 3 && item.length < 120) {
            actionItems.push(item);
          }
        }
      }
    }

    return [...new Set(actionItems)].slice(0, 5);
  }

  // ── Fallback compression ────────────────────────────────────────────────────

  /**
   * Compress messages into a brief summary when no structured
   * points are found.
   */
  private compressMessages(messages: ChatMessage[], maxTokens: number): string {
    // Take the first and last user messages as anchors.
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      return `Conversation with ${messages.length} messages.`;
    }

    const firstMsg = userMessages[0].content;
    const lastMsg = userMessages[userMessages.length - 1].content;

    const segments: string[] = [];
    if (firstMsg.length > 0) {
      segments.push(`Started with: "${this.truncate(firstMsg, 100)}"`);
    }
    if (userMessages.length > 1) {
      segments.push(
        `Latest: "${this.truncate(lastMsg, 100)}"`,
      );
    }
    segments.push(`Total: ${messages.length} messages exchanged.`);

    let result = segments.join(' ');
    return this.truncateToTokenBudget(result, maxTokens);
  }

  // ── Token estimation (mirrors ContextWindowManager) ─────────────────────────

  /**
   * Estimate token count for text (chars/4 with 10% overhead).
   */
  private estimateTokens(text: string): number {
    if (text.length === 0) return 0;
    const cjkCount = (text.match(/[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g) ?? []).length;
    const remaining = text.length - cjkCount;
    return Math.ceil((cjkCount + remaining / 4) * 1.1);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Truncate text to a maximum character length.
   */
  private truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3).trimEnd() + '...';
  }

  /**
   * Truncate text to fit within a token budget.
   */
  private truncateToTokenBudget(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    // Reduce proportionally.
    const ratio = maxTokens / estimatedTokens;
    const targetChars = Math.floor(text.length * ratio * 0.9); // slight buffer
    return this.truncate(text, Math.max(targetChars, 20));
  }
}
