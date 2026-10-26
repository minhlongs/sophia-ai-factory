/**
 * Deep-link URL generators for LLM Prompt Launchers (ChatGPT, Claude, Perplexity).
 * Layer: seed/aeo
 */

import { SOPHIA_BASE_URL } from './ground-truth-catalog';
import { redactSecretsFromText } from './pii-secret-redactor';

export interface DeepLinkPromptOptions {
  readonly canonicalUrl: string;
  readonly isVi: boolean;
  readonly contextSnippet?: string;
}

export function buildDeepLinkPromptText({ canonicalUrl, isVi, contextSnippet }: DeepLinkPromptOptions): string {
  const safeSnippet = contextSnippet ? redactSecretsFromText(contextSnippet).slice(0, 300) : '';
  const snippetPart = safeSnippet ? `\n\nNội dung tóm tắt:\n${safeSnippet}` : '';

  if (isVi) {
    return `Đọc và phân tích thông tin về nền tảng Sophia AI Factory qua tài liệu chính thức tại: ${canonicalUrl}.md\n\nGiải thích mô hình BYOK (Bring Your Own Key), các gói cước và khả năng tự động hóa video AI kết hợp tiếp thị liên kết.${snippetPart}`;
  }
  return `Analyze the official documentation of Sophia AI Factory at: ${canonicalUrl}.md\n\nExplain its zero-markup BYOK AI video automation, affiliate rails, and pricing tiers.${snippetPart}`;
}

export function buildLlmDeepLinkUrls(options: DeepLinkPromptOptions) {
  const prompt = buildDeepLinkPromptText(options);
  const encodedPrompt = encodeURIComponent(prompt.slice(0, 1800));

  return {
    chatgpt: `https://chatgpt.com/?q=${encodedPrompt}`,
    claude: `https://claude.ai/new?q=${encodedPrompt}`,
    perplexity: `https://www.perplexity.ai/search?q=${encodedPrompt}`,
  };
}
