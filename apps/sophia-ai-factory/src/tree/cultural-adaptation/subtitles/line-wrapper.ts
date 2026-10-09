/**
 * Japanese Bunsetsu & Space-Aware Line Wrapping
 *
 * @module tree/cultural-adaptation/subtitles/line-wrapper
 */

const BUNSETSU_PARTICLES = [
  'は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'から', 'まで', 'より', 'など',
  'けど', 'ので', 'のに', 'たら', 'なら', 'ば', 'て', 'ても', 'ないで',
];

const JAPANESE_PUNCTUATION = ['、', '。', '！', '？', '!', '?', '…', '・'];

/**
 * Break Japanese text into natural grammatical chunks (Bunsetsu).
 * Avoids breaking words mid-compound while keeping line length under maxCpl.
 */
export function breakJapaneseBunsetsu(text: string, maxCpl = 16): string[] {
  if (!text) return [];
  if (text.length <= maxCpl) return [text];

  const chunks: string[] = [];
  let currentChunk = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1] || '';
    const twoChar = char + nextChar;
    currentChunk += char;

    const isPunctuation = JAPANESE_PUNCTUATION.includes(char);
    const isTwoCharParticle = BUNSETSU_PARTICLES.includes(twoChar);
    const isOneCharParticle = BUNSETSU_PARTICLES.includes(char) && !isTwoCharParticle;

    if (isPunctuation || isOneCharParticle || (isTwoCharParticle && currentChunk.length >= 4)) {
      if (currentChunk.length >= 6 || isPunctuation) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const chunk of chunks) {
    if (currentLine.length + chunk.length <= maxCpl) {
      currentLine += chunk;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = chunk;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const finalLines: string[] = [];
  for (const line of lines) {
    if (line.length <= maxCpl) {
      finalLines.push(line);
    } else {
      for (let j = 0; j < line.length; j += maxCpl) {
        finalLines.push(line.slice(j, j + maxCpl));
      }
    }
  }

  return finalLines;
}

/**
 * Greedy space-aware line wrapping for Latin and segmented scripts.
 */
export function wrapWords(text: string, maxCpl: number): string[] {
  if (!text) return [];
  if (text.length <= maxCpl) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxCpl) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
