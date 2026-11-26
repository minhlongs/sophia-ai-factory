/**
 * Edge Preview & Crawler Bot User-Agent Classifier.
 *
 * Clean-room edge primitive inspired by high-volume link attribution platforms:
 * identifies link-preview bots (Telegram, X, Meta, WhatsApp, Discord, Slack,
 * LinkedIn) and AI/search crawlers (GPTBot, ClaudeBot, PerplexityBot, Googlebot)
 * so /api/r/[code] redirects stay fast while keeping human EPC/CTR metrics clean.
 *
 * Layer: seed/security (pure function, zero external deps)
 *
 * @module seed/security/bot-user-agent
 */

const BOT_USER_AGENT_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['telegram_preview', /TelegramBot/i],
  ['x_preview', /Twitterbot/i],
  ['meta_preview', /facebookexternalhit|Facebot|Meta-ExternalAgent/i],
  ['whatsapp_preview', /WhatsApp/i],
  ['discord_preview', /Discordbot/i],
  ['slack_preview', /Slackbot/i],
  ['linkedin_preview', /LinkedInBot/i],
  ['ai_crawler', /GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|anthropic-ai|PerplexityBot|Google-Extended/i],
  ['search_crawler', /Googlebot|Bingbot|Baiduspider|YandexBot|DuckDuckBot|Applebot|AhrefsBot|SemrushBot/i],
  ['headless_probe', /HeadlessChrome|Playwright|Puppeteer|curl\/|wget\/|python-requests|Go-http-client/i],
];

export interface BotClassification {
  readonly isBot: boolean;
  readonly botCategory: string | null;
}

export function classifyBotUserAgent(userAgent: string | null | undefined): BotClassification {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return { isBot: true, botCategory: 'empty_user_agent' };
  }
  for (const [category, pattern] of BOT_USER_AGENT_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, botCategory: category };
    }
  }
  return { isBot: false, botCategory: null };
}

export function isPreviewOrCrawlerBot(userAgent: string | null | undefined): boolean {
  return classifyBotUserAgent(userAgent).isBot;
}
