/**
 * Newsletter prompt sanitization, construction, and LLM response parsing helpers.
 * @module land/scripts/newsletter-prompt-parser
 */

import type { GenerateNewsletterInput } from './generate-newsletter';

export const DEFAULT_NEWSLETTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

export function sanitizeNewsletterPrompt(input: string): string {
  const patterns = [
    /ignore\s+(all\s+)?previous\s+instructions?/gi,
    /reveal\s+(your\s+)?system\s+prompt/gi,
    /output\s+your\s+(full\s+)?system/gi,
    /---\s*\n/g,
    /```system/gi,
    /<\/?system>/gi,
    /\{\{|\}\}|<%|%>/g,
  ];
  let cleaned = input;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, '[filtered]');
  }
  return cleaned.trim().slice(0, 3000);
}

export function buildNewsletterPrompt(input: GenerateNewsletterInput): string {
  const lang = input.language === 'vi' ? 'Vietnamese' : 'English';
  const safeIntro = input.editorIntro ? sanitizeNewsletterPrompt(input.editorIntro) : '';
  const introLine = safeIntro ? `Include this editor intro near the top: "${safeIntro}"` : '';
  const safeTopic = sanitizeNewsletterPrompt(input.topic);
  const ctaLine = input.ctaText
    ? `End with a call-to-action button text: "${input.ctaText}"`
    : '';

  return [
    `Write a ${lang}-language email newsletter for the brand "${input.brandName}".`,
    `Topic/theme this week: ${safeTopic}`,
    `Tone: ${input.tone}`,
    introLine,
    'Structure:',
    '1. A catchy subject line (prefix with SUBJECT: on its own line)',
    '2. A greeting and brief intro paragraph',
    '3. 2-3 content sections with ## headings covering the topic',
    '4. A brief closing paragraph',
    ctaLine,
    '',
    'Output the newsletter body in clean HTML (use <h2>, <p>, <ul>, <strong>, <a> tags).',
    'Put the subject line on the FIRST line as: SUBJECT: Your Subject Here',
    'Then the HTML body after a blank line.',
    'Keep total length 300-500 words.',
    'Do not wrap in ```html blocks or add explanations.',
  ]
    .filter((s) => s.length > 0)
    .join('\n');
}

export function parseNewsletterResponse(raw: string): {
  subject: string;
  html: string;
  plainText: string;
} {
  const lines = raw.split('\n');
  let subject = '';
  const bodyLines: string[] = [];
  let foundSubject = false;

  for (const line of lines) {
    const m = /^SUBJECT:\s*(.+)$/i.exec(line.trim());
    if (m && !foundSubject) {
      subject = m[1].trim();
      foundSubject = true;
    } else {
      bodyLines.push(line);
    }
  }

  const html = bodyLines.join('\n').trim();
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!subject) {
    subject = `Newsletter from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return { subject, html, plainText };
}
