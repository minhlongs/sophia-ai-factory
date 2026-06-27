/**
 * ConversationSummarizer Tests

 * Validates deterministic extractive summarization: short conversations
 * produce summaries, empty conversations produce empty summaries,
 * and the summarizer degrades gracefully on edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationSummarizer } from '../conversation-summarizer';

const makeMessage = (
  role: 'user' | 'assistant',
  content: string,
): { role: 'user' | 'assistant'; content: string } => ({ role, content });

describe('ConversationSummarizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Short conversation → summary ──────────────────────────────────────

  describe('short conversation summarization', () => {
    it('produces a summary for a short conversation with topics', async () => {
      const summarizer = new ConversationSummarizer(500);
      const messages = [
        makeMessage('user', 'I want to build a SaaS platform for video generation'),
        makeMessage('assistant', 'Great! What features do you need?'),
        makeMessage('user', 'I need AI-powered video creation and social media publishing'),
        makeMessage('assistant', 'We can help with both. Let me outline a plan.'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.messagesSummarized).toBe(4);
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it('extracts topics from user messages', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'I need help with Docker containerization and Kubernetes deployment'),
        makeMessage('assistant', 'Docker and K8s are great choices for scaling.'),
        makeMessage('user', 'Also need CI/CD pipeline with GitHub Actions'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.topics.length).toBeGreaterThan(0);
      expect(result.topics.every((t) => t.length > 2)).toBe(true);
    });

    it('extracts decisions from the conversation', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', "Let's go with React for the frontend"),
        makeMessage('assistant', 'React is a solid choice.'),
        makeMessage('user', 'We decided to use Cloudflare Workers for deployment'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it('extracts user preferences', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'I prefer dark mode for the interface'),
        makeMessage('assistant', 'Noted, we will use dark mode.'),
        makeMessage('user', 'I like the blue color scheme'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.userPreferences.length).toBeGreaterThan(0);
    });

    it('extracts action items', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'I need to set up the database schema next week'),
        makeMessage('assistant', 'I will prepare the schema for you.'),
        makeMessage('user', 'Make sure to include user authentication'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.actionItems.length).toBeGreaterThan(0);
    });

    it('respects the maxSummaryTokens budget', async () => {
      const summarizer = new ConversationSummarizer(50);
      const messages = [
        makeMessage('user', 'a'.repeat(500)),
        makeMessage('assistant', 'b'.repeat(500)),
        makeMessage('user', 'c'.repeat(500)),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.summary.length).toBeLessThan(300);
    });
  });

  // ── Empty conversation → empty summary ────────────────────────────────

  describe('empty conversation handling', () => {
    it('produces a summary for an empty message array', async () => {
      const summarizer = new ConversationSummarizer();
      const result = await summarizer.summarize([]);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(0);
      expect(result.topics).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.userPreferences).toEqual([]);
      expect(result.actionItems).toEqual([]);
    });

    it('produces a summary with only assistant messages (no user messages)', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('assistant', 'Hello! How can I help you today?'),
        makeMessage('assistant', 'I can assist with many topics.'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.topics).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.userPreferences).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(2);
    });

    it('handles a single message', async () => {
      const summarizer = new ConversationSummarizer();
      const result = await summarizer.summarize([
        makeMessage('user', 'Hello, I need help with my project'),
      ]);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(1);
    });
  });

  // ── extractKeyPoints ──────────────────────────────────────────────────

  describe('extractKeyPoints', () => {
    it('returns empty arrays for empty input', () => {
      const summarizer = new ConversationSummarizer();
      const result = summarizer.extractKeyPoints([]);
      expect(result.topics).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.userPreferences).toEqual([]);
      expect(result.actionItems).toEqual([]);
    });

    it('extracts key points from a rich conversation', () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'I want to build an e-commerce platform with Next.js'),
        makeMessage('assistant', 'Next.js is great for e-commerce.'),
        makeMessage('user', "Let's go with Stripe for payments"),
        makeMessage('assistant', 'Stripe integration is straightforward.'),
        makeMessage('user', 'I prefer a minimalist design with blue accents'),
        makeMessage('assistant', 'I will design it with a minimalist approach.'),
        makeMessage('user', 'Remember to add user authentication and email notifications'),
      ];
      const result = summarizer.extractKeyPoints(messages);
      expect(result.topics.length).toBeGreaterThan(0);
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.userPreferences.length).toBeGreaterThan(0);
      expect(result.actionItems.length).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles very long messages without crashing', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'x'.repeat(10_000)),
        makeMessage('assistant', 'y'.repeat(10_000)),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(2);
    });

    it('handles messages with special characters and unicode', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'Xin chào! Tôi cần hỗ trợ với dự án của mình 🚀'),
        makeMessage('assistant', 'Chào bạn! Tôi sẽ giúp bạn với dự án.'),
        makeMessage('user', 'Cảm ơn bạn rất nhiều! 🙏'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(3);
    });

    it('handles messages with only whitespace', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', ' '),
        makeMessage('assistant', '\t\n'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(2);
    });

    it('handles messages with newlines and formatting', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'Here is my plan:\n- Step 1: Setup\n- Step 2: Build\n- Step 3: Deploy'),
        makeMessage('assistant', 'That looks like a solid plan.'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.summary).toBeTruthy();
      expect(result.messagesSummarized).toBe(2);
    });

    it('deduplicates extracted points', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'I need Docker for containerization'),
        makeMessage('assistant', 'Docker is a good choice.'),
        makeMessage('user', 'I need Docker for deployment'),
      ];
      const result = await summarizer.summarize(messages);
      const dockerCount = result.topics.filter((t) => t === 'docker').length;
      expect(dockerCount).toBeLessThanOrEqual(1);
    });

    it('limits topics to at most 5', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', 'Docker Kubernetes React TypeScript Node.js Python AWS Terraform Ansible Nginx'),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.topics.length).toBeLessThanOrEqual(5);
    });

    it('limits decisions to at most 5', async () => {
      const summarizer = new ConversationSummarizer();
      const messages = [
        makeMessage('user', "Let's go with option A. We decided on option B. I want option C. Going with option D. Selected option E. Chosen option F."),
      ];
      const result = await summarizer.summarize(messages);
      expect(result.decisions.length).toBeLessThanOrEqual(5);
    });
  });
});
