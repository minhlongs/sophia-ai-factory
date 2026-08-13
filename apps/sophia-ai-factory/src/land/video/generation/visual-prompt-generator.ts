/**
 * Visual Prompt Generator
 *
 * Converts a video script into 3-5 cinematic scene descriptions
 * via Anthropic Claude Sonnet API (raw fetch, no SDK dependency).
 * PII stripped before sending.
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const PII_PATTERN = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b|\b\d{9,}\b/gi;
const SERVICE_NAME = 'nhÃ  cung cáº¥p dá»‹ch vá»¥ AI';

function stripPii(text: string): string {
  return text.replace(PII_PATTERN, '[REDACTED]');
}

export interface ScenePrompt {
  index: number;
  description: string;
}

export interface GenerateVisualPromptsInput {
  scriptText: string;
  maxScenes?: number;
}

export interface GenerateVisualPromptsResult {
  scenes: ScenePrompt[];
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

/**
 * Generate 3-5 cinematic scene descriptions from script text.
 * Strips PII before sending to Anthropic API.
 * Falls back to a single generic scene if API call fails or key not set.
 */
export async function generateVisualPrompts(
  input: GenerateVisualPromptsInput,
): Promise<GenerateVisualPromptsResult> {
  const { scriptText, maxScenes = 5 } = input;
  const safeText = stripPii(scriptText).slice(0, 3000);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { scenes: [{ index: 0, description: 'A professional product showcase scene with clean background' }] };
  }

  const messages: AnthropicMessage[] = [
    {
      role: 'user',
      content: `Generate 3-5 cinematic scene descriptions, each exactly 1 sentence, for this video script. Return only a JSON array of strings, no other text:\n\n${safeText}`,
    },
  ];

  if (!shouldAllowRequest(SERVICE_NAME)) {
    return { scenes: [{ index: 0, description: 'A professional product showcase scene with clean background' }] };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        messages,
      }),
    });

    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure(SERVICE_NAME, kind);
      return { scenes: [{ index: 0, description: 'A professional product showcase scene with clean background' }] };
    }

    recordSuccess(SERVICE_NAME);

    const data = (await res.json()) as AnthropicResponse;
    const raw = data.content[0];
    if (raw.type !== 'text' || !raw.text) throw new Error('Unexpected response type');

    const parsed: string[] = JSON.parse(raw.text.trim());
    const limited = parsed.slice(0, maxScenes);

    return {
      scenes: limited.map((description, index) => ({ index, description })),
    };
  } catch (error) {
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    return {
      scenes: [{ index: 0, description: 'A professional product showcase scene with clean background' }],
    };
  }
}
