/**
 * Dual-Engine Browser-Local TTS Device Probe & Stream Chunker.
 *
 * Clean-room primitive (Apache-2.0/MIT patterns from hexgrad/kokoro,
 * met4citizen/HeadTTS, izlabs/voice-desk-tts, and open-webui#33232):
 * - Asynchronously probes navigator.gpu.requestAdapter() to avoid WebGPU hangs.
 * - Routes EN -> Kokoro-82M q8f16 (WebGPU/WASM) and VI -> Piper vi_VN (WASM-only).
 * - Splits narration into <=400-char chunks for non-blocking Web Worker synthesis.
 *
 * Layer: seed/video (pure browser-safe helper, zero server GPU COGS)
 *
 * @module seed/video/browser-tts-device-probe
 */

export type LocalTtsEngineId = 'kokoro_82m_q8f16' | 'piper_vi_vn_wasm';
export type LocalTtsDevice = 'webgpu' | 'wasm';

export interface LocalTtsSelection {
  readonly engine: LocalTtsEngineId;
  readonly device: LocalTtsDevice;
  readonly locale: 'en' | 'vi';
}

interface GpuLikeNavigator {
  readonly gpu?: {
    requestAdapter?: () => Promise<unknown>;
  };
}

export async function probeWebGpuDevice(
  nav: GpuLikeNavigator | undefined = typeof navigator !== 'undefined'
    ? (navigator as unknown as GpuLikeNavigator)
    : undefined,
): Promise<LocalTtsDevice> {
  if (!nav?.gpu || typeof nav.gpu.requestAdapter !== 'function') {
    return 'wasm';
  }
  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

export async function selectBrowserLocalTtsEngine(
  locale: 'en' | 'vi',
  nav?: GpuLikeNavigator,
): Promise<LocalTtsSelection> {
  if (locale === 'vi') {
    return { engine: 'piper_vi_vn_wasm', device: 'wasm', locale: 'vi' };
  }
  const device = await probeWebGpuDevice(nav);
  return { engine: 'kokoro_82m_q8f16', device, locale: 'en' };
}

export function splitTextForTtsWorker(text: string, maxChars: number = 400): readonly string[] {
  const safeMax = Math.max(80, maxChars);
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    const candidate = current ? `${current} ${s}` : s;
    if (candidate.length <= safeMax) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = s.length <= safeMax ? s : s.slice(0, safeMax);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
