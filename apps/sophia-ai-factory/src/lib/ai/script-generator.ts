import { Tier } from "@/types";
import { trackUsage, hashLicenseKey, calculateCredits, startTimer } from '@/lib/usage-metering';
import { getUsageContext } from '@/lib/usage-metering/context';
import { logger } from '@/lib/utils/logger-utility';

interface GenerateScriptInput {
  topic: string;
  audience: string;
  tier: Tier;
  userId?: string;
  licenseKey?: string;
  licenseNonce?: string;
}

interface ScriptOutput {
  title: string;
  scenes: {
    scene_number: number;
    visual_description: string;
    narration: string;
    duration_estimate: number;
  }[];
  total_duration: number;
}

/**
 * Generates a video script using OpenRouter API.
 * Falls back to mock if API key is not configured.
 */
export async function generateScript(input: GenerateScriptInput): Promise<ScriptOutput> {
  const { topic, audience, tier, userId, licenseKey, licenseNonce } = input;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const stopTimer = startTimer();

  // Get context if available (from async local storage)
  const context = getUsageContext();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = hashLicenseKey(finalLicenseKey || 'unknown');

  // Fallback to mock if no API key
  if (!apiKey) {
    const mockResult = generateMockScript(topic, audience);
    // Track mock usage
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash: 'mock',
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/mock',
      action: 'chat_completion_mock',
      creditsUsed: 1,
      tierAtRequest: tier,
      statusCode: 200,
      responseTimeMs: stopTimer(),
    });
    return mockResult;
  }

  try {
    const systemPrompt = `You are an expert video script writer specializing in affiliate marketing content. Create engaging, conversion-focused scripts that hook viewers immediately and build desire for the product.`;

    const userPrompt = `Create a video script for promoting a product about "${topic}" to ${audience}.

Requirements:
- Hook the viewer in the first 5 seconds
- 3-5 scenes total
- Each scene should have clear visual description and narration
- Total duration: 15-30 seconds
- Focus on benefits and transformation

Return ONLY valid JSON in this exact format:
{
  "title": "string",
  "scenes": [
    {
      "scene_number": 1,
      "visual_description": "string",
      "narration": "string",
      "duration_estimate": 5
    }
  ],
  "total_duration": 16
}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Sophia AI Factory',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: tier === 'ENTERPRISE' ? 'anthropic/claude-3.5-sonnet' : 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const responseTime = stopTimer();

    if (!response.ok) {
      const errorText = await response.text();
      // Track failed usage
      await trackUsage({
        userId: finalUserId,
        licenseKeyHash: licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'openrouter',
        endpoint: '/chat/completions',
        action: 'chat_completion',
        tierAtRequest: tier,
        statusCode: response.status,
        errorMessage: errorText,
        responseTimeMs: responseTime,
        creditsUsed: 0, // Failed call, no credits charged
      });
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    const parsed = JSON.parse(content) as ScriptOutput;

    // Validate required fields
    if (!parsed.title || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('Invalid script format from API');
    }

    // Extract token usage from OpenRouter response
    const usage = data.usage;
    const tokensTotal = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

    // Track successful usage
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash: licenseKeyHash,
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tokensInput: usage?.prompt_tokens ?? 0,
      tokensOutput: usage?.completion_tokens ?? 0,
      creditsUsed: calculateCredits('openrouter', 'chatCompletion', tokensTotal, tier),
      modelName: data.model,
      requestId: data.id,
      tierAtRequest: tier,
      statusCode: response.status,
      responseTimeMs: responseTime,
    });

    return parsed;

  } catch (error) {
    // Track error
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash: licenseKeyHash,
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tierAtRequest: tier,
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs: stopTimer(),
      creditsUsed: 0, // Failed call, no credits charged
    });

    return generateMockScript(topic, audience);
  }
}

/**
 * Mock script generator for fallback or development
 */
function generateMockScript(topic: string, audience: string): ScriptOutput {
  return {
    title: `The Ultimate Guide to ${topic}`,
    scenes: [
      {
        scene_number: 1,
        visual_description: "Fast-paced montage of successful people working.",
        narration: `Are you tired of failing at ${topic}? You're not alone.`,
        duration_estimate: 5
      },
      {
        scene_number: 2,
        visual_description: "Graphic showing statistics rising.",
        narration: `In this video, I'm going to show you the secret method that ${audience} are using to dominate.`,
        duration_estimate: 8
      },
      {
        scene_number: 3,
        visual_description: "Host speaking directly to camera with confidence.",
        narration: "Let's dive in.",
        duration_estimate: 3
      }
    ],
    total_duration: 16
  };
}
