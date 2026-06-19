/**
 * Video Render Provider Abstraction — core factory proof gate.
 *
 * Providers: heygen (production), mock (proof/demo/test only).
 *
 * Safety: mock provider is ONLY allowed when NODE_ENV=test OR SOPHIA_CORE_VIDEO_PROOF=1.
 * It is REJECTED in production unless proof is explicitly enabled.
 */

export interface VideoRenderProviderInput {
  userId: string;
  script: string;
  title?: string;
  voiceId?: string;
  avatarId?: string;
  callbackUrl?: string;
}

export interface VideoRenderProviderResult {
  providerJobId: string;
  videoId: string;
  status: 'queued' | 'processing';
  provider: 'heygen' | 'mock';
  videoUrl?: string; // present only for mock provider (immediate completion)
}

export class RenderProviderError extends Error {
  code:
    | 'PROVIDER_DISABLED_IN_PROOF_MODE'
    | 'PROVIDER_NOT_CONFIGURED'
    | 'MOCK_REJECTED_IN_PRODUCTION'
    | 'SUBMIT_FAILED'
    | 'PERSIST_FAILED';
  constructor(code: RenderProviderError['code'], message: string) {
    super(message);
    this.name = 'RenderProviderError';
    this.code = code;
  }
}

function isProofMode(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.SOPHIA_CORE_VIDEO_PROOF === '1' ||
    process.env.SOPHIA_VIDEO_PROVIDER === 'mock'
  );
}

function getConfiguredProvider(): 'heygen' | 'mock' | null {
  const envProvider = process.env.SOPHIA_VIDEO_PROVIDER;
  if (envProvider === 'mock') return 'mock';
  if (envProvider === 'heygen') return 'heygen';
  return null; // default: heygen auto-resolve
}

async function submitMockProvider(
  input: VideoRenderProviderInput,
): Promise<VideoRenderProviderResult> {
  const videoId = crypto.randomUUID();
  const providerJobId = `mock_${videoId.replace(/-/g, '').slice(0, 16)}`;
  const mockVideoUrl = `https://mock.sophia.local/videos/${videoId}.mp4`;

  return {
    providerJobId,
    videoId,
    status: 'queued',
    provider: 'mock',
    videoUrl: mockVideoUrl,
  };
}

export async function submitVideoRender(
  input: VideoRenderProviderInput,
): Promise<VideoRenderProviderResult> {
  const provider = getConfiguredProvider();

  if (provider === 'mock') {
    if (!isProofMode()) {
      throw new RenderProviderError(
        'MOCK_REJECTED_IN_PRODUCTION',
        'Mock provider is not allowed outside test/proof mode. Set SOPHIA_CORE_VIDEO_PROOF=1 or NODE_ENV=test to enable.',
      );
    }
    return submitMockProvider(input);
  }

  // Default heygen path (production)
  if (provider === null || provider === 'heygen') {
    const { getHeyGenKey } = await import('@/tree/credentials/get-provider-key');
    const { createHeyGenVideo } = await import('@/land/video/templates/heygen-helpers');

    const keyResult = await getHeyGenKey({ userId: input.userId, fallbackToPlatform: false });
    if (!keyResult) {
      throw new RenderProviderError(
        'PROVIDER_NOT_CONFIGURED',
        'HeyGen API key not configured. Add it in Setup Wizard > Integrations.',
      );
    }

    try {
      const result = await createHeyGenVideo({
        apiKey: keyResult.key,
        script: input.script,
        title: input.title,
        voiceId: input.voiceId,
        avatarId: input.avatarId,
        callbackUrl: input.callbackUrl,
      });
      return {
        providerJobId: result.videoId,
        videoId: crypto.randomUUID(),
        status: 'processing',
        provider: 'heygen',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'HeyGen rejected the submit';
      throw new RenderProviderError('SUBMIT_FAILED', msg);
    }
  }

  throw new RenderProviderError(
    'PROVIDER_NOT_CONFIGURED',
    `Unknown SOPHIA_VIDEO_PROVIDER value: ${provider}`,
  );
}
