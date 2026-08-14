/**
 * @module seed/ai/conversation-summarizer-types
 *
 * Types and configuration constants for conversation summarization.
 * Extracted from conversation-summarizer.ts to keep each file ≤200 LOC.
 */

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

// ── Configuration ─────────────────────────────────────────────────────────────

/** English stop words filtered during topic extraction. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but',
  'and', 'or', 'if', 'while', 'about', 'up', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom',
]);

/** Regex patterns for detecting decisions in messages. */
export const DECISION_PATTERNS: RegExp[] = [
  /(?:we'll|we will|let's|going with|chosen|selected|decided|agreed|confirmed|finalized)\s+(.+?)(?:\.|$)/i,
  /(?:decision|chose|picked|settled on)\s+(?:is|:)?\s*(.+?)(?:\.|$)/i,
  /(?:i want|i need|i prefer|i'd like)\s+(.+?)(?:\.|$)/i,
];

/** Regex patterns for detecting user preferences. */
export const PREFERENCE_PATTERNS: RegExp[] = [
  /(?:i (?:like|love|prefer|want|need|enjoy|hate|dislike|don't want|do not want))\s+(.+?)(?:\.|$)/i,
  /(?:my (?:favorite|preference|style|choice|pick))\s+(?:is|:)?\s*(.+?)(?:\.|$)/i,
  /(?:make it|keep it|use|go with)\s+(.+?)(?:\.|$)/i,
];

/** Regex patterns for detecting action items. */
export const ACTION_PATTERNS: RegExp[] = [
  /(?:todo|to-do|task|action item|next step|follow up|follow-up)[\s:]+(.+?)(?:\.|$)/i,
  /(?:need to|must|should|have to|going to)\s+(.+?)(?:\.|$)/i,
  /(?:remind me|don't forget|make sure)\s+(?:to\s+)?(.+?)(?:\.|$)/i,
];
