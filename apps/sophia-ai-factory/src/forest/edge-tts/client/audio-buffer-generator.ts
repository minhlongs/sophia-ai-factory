/**
 * Synthetic Audio Buffer Generator
 * Provides valid offline/edge test audio fallback.
 * Layer: forest/edge-tts
 */

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Creates a valid synthetic audio buffer for offline/edge test environments.
 */
export function createSyntheticAudioBuffer(text: string, durationSec: number): Uint8Array {
  const sampleRate = 24000;
  const numSamples = Math.floor(sampleRate * Math.min(durationSec, 5));
  // Simple RIFF WAV header (44 bytes) + PCM data
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Fill gentle sinusoidal tone based on text hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash << 5) - hash + text.charCodeAt(i);
  const freq = 200 + Math.abs(hash % 200);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.1 * 32767;
    view.setInt16(44 + i * 2, Math.floor(sample), true);
  }

  return new Uint8Array(buffer);
}
