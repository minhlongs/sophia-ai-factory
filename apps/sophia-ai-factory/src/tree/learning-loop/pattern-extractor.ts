/**
 * Creative Pattern Extractor — Phase 5: Auto-Creative Playbook
 *
 * Pure domain logic extracting creative attributes (hook styles, voice profiles, duration patterns)
 * from script scenes, audio tracks, and video assets.
 *
 * Layer: tree (domain reusable — only imports from @/seed)
 */

import type {
  HookStyle,
  VoiceProfile,
  DurationPattern,
  ExtractedCreativeVariables,
  LearningLoopAssetInput,
  ScriptSceneData,
} from './types';

const VALID_HOOK_STYLES: ReadonlySet<HookStyle> = new Set([
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
]);

const VALID_VOICE_PROFILES: ReadonlySet<VoiceProfile> = new Set([
  'dynamic_hook',
  'enthusiastic_recommender',
  'calm_authoritative',
  'cinematic_narrator',
]);

/**
 * Bucket video duration in seconds into standard short-form buckets.
 */
export function bucketDurationPattern(seconds: number | string | null | undefined): DurationPattern {
  if (seconds == null || seconds === '') return '0-15s';
  const n = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '0-15s';
  if (n <= 15) return '0-15s';
  if (n <= 30) return '16-30s';
  if (n <= 60) return '31-60s';
  if (n <= 90) return '61-90s';
  return '90s+';
}

function resolveTextFromInput(input: unknown): string {
  if (typeof input === 'string') {
    return input.trim();
  }
  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    const narration = typeof record.narration === 'string' ? record.narration : '';
    const prompt = typeof record.prompt === 'string' ? record.prompt : '';
    const title = typeof record.title === 'string' ? record.title : '';
    const content = typeof record.text === 'string' ? record.text : '';
    return (narration || prompt || content || title).trim();
  }
  return '';
}

function classifyHookByRegex(lower: string): HookStyle {
  // 1. Story lead: personal anecdotal or timeline openers
  if (
    /it all started|last year|when i was|a few years ago|i used to|my journey/i.test(lower) ||
    /hồi đó|năm ngoái|ngày xưa|khi tôi|hành trình|câu chuyện/i.test(lower)
  ) {
    return 'story_lead';
  }

  // 2. Problem agitation: warning, mistakes, friction, pain points
  if (
    /stop doing|biggest mistake|warning|danger|tired of|frustrated|don't ever|hate when|struggling with/i.test(lower) ||
    /dừng lại|sai lầm|cảnh báo|nguy hiểm|mệt mỏi|đừng bao giờ|vấn đề|bế tắc|thất bại|nỗi đau/i.test(lower)
  ) {
    return 'problem_agitation';
  }

  // 3. Curiosity gap: teasing incomplete information or dramatic conclusions
  if (
    /wait until|the secret|you won't believe|what happens next|here is what happened|there is one thing/i.test(lower) ||
    /cái kết|điều bí mật|chờ xem|bất ngờ|không thể tin/i.test(lower)
  ) {
    return 'curiosity_gap';
  }

  // 4. Bold claim: shocking assertions, transformative statements
  if (
    /unbelievable|nobody tells you|the truth about|shocking|guaranteed|impossible|10x|completely change|game changer/i.test(lower) ||
    /will\s+(\w+\s+)?change|thay đổi hoàn toàn|sự thật gây sốc|đột phá|kinh ngạc|gấp 10|chắc chắn/i.test(lower)
  ) {
    return 'bold_claim';
  }

  // 5. Statistic reveal: percentages (90%), dollar signs ($100), numbered counts (3 reasons, 5 steps)
  if (
    /\d+(\.\d+)?%|\$\d+|\b\d+\s*(reasons|steps|ways|people|million|percent|hours|days|years)\b/i.test(lower) ||
    /\b\d+\s*(lý do|cách|bước|người|triệu|tỷ|ngày|năm|giờ)\b/i.test(lower) ||
    /statistics|thống kê/i.test(lower)
  ) {
    return 'statistic_reveal';
  }

  // 6. Question: explicit question mark or standard interrogation words
  if (
    /\?|why|how|what if|did you know|have you ever|who else|where do|can you|are you/i.test(lower) ||
    /tại sao|làm sao|làm thế nào|bạn có biết|liệu|ai có thể|đã bao giờ/i.test(lower)
  ) {
    return 'question';
  }

  return 'curiosity_gap';
}

/**
 * Classify hook style from scene 0 narration, prompt, or raw text.
 * Uses bilingual regex heuristics (EN/VI) with fallback to 'curiosity_gap'.
 */
export function extractHookStyleFromScene0(input: unknown): HookStyle {
  if (!input) return 'curiosity_gap';

  if (typeof input === 'string' && VALID_HOOK_STYLES.has(input.trim() as HookStyle)) {
    return input.trim() as HookStyle;
  }

  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    const explicitTag = (record.hookStyle || record.hook_style) as string | undefined;
    if (explicitTag && VALID_HOOK_STYLES.has(explicitTag as HookStyle)) {
      return explicitTag as HookStyle;
    }
  }

  const text = resolveTextFromInput(input);
  if (!text) return 'curiosity_gap';

  return classifyHookByRegex(text.toLowerCase());
}

function resolveVoiceProfileStyle(rawStyle: string): VoiceProfile {
  if (rawStyle && VALID_VOICE_PROFILES.has(rawStyle as VoiceProfile)) {
    return rawStyle as VoiceProfile;
  }

  const normalized = rawStyle.toLowerCase();
  if (/dynamic|hook|punchy|fast|hype|energetic/.test(normalized)) {
    return 'dynamic_hook';
  }
  if (/enthusiastic|recommender|warm|friendly|affiliate|recommend/.test(normalized)) {
    return 'enthusiastic_recommender';
  }
  if (/narrator|cinematic|story|documentary|epic|deep/.test(normalized)) {
    return 'cinematic_narrator';
  }
  return 'calm_authoritative';
}

function extractVoiceIdFromMetadata(metadata: Record<string, unknown>): string | undefined {
  const candidates = [metadata.voiceId, metadata.voice_id, metadata.providerVoiceId];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

function extractRawStyleFromMetadata(metadata: Record<string, unknown>): string {
  const candidates = [metadata.voiceStyle, metadata.voice_style, metadata.voiceProfile, metadata.voice_profile];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Extract voice profile from audio metadata or audio configuration.
 */
export function extractVoiceProfileFromMetadata(metadata?: Record<string, unknown>): {
  voiceProfile: VoiceProfile;
  voiceId?: string;
} {
  if (!metadata) {
    return { voiceProfile: 'calm_authoritative' };
  }

  const voiceId = extractVoiceIdFromMetadata(metadata);
  const rawStyle = extractRawStyleFromMetadata(metadata);

  return {
    voiceProfile: resolveVoiceProfileStyle(rawStyle),
    voiceId,
  };
}

function resolveScene0(
  scriptAsset?: LearningLoopAssetInput,
  constraints?: Record<string, unknown>,
  title?: string,
): { scene0Input: unknown; sceneCount: number } {
  let scene0Input: unknown = null;
  let sceneCount = 1;

  if (scriptAsset?.metadata) {
    const meta = scriptAsset.metadata;
    if (Array.isArray(meta.scenes) && meta.scenes.length > 0) {
      scene0Input = meta.scenes[0] as ScriptSceneData;
      sceneCount = meta.scenes.length;
    } else if (meta.scene0) {
      scene0Input = meta.scene0;
    } else if (meta.narration || meta.prompt || meta.title) {
      scene0Input = meta;
    }
    if (typeof meta.scenesCount === 'number') {
      sceneCount = meta.scenesCount;
    }
  }

  if (!scene0Input && constraints) {
    scene0Input = constraints.hookStyle || constraints.title || title;
  }

  return { scene0Input, sceneCount };
}

function resolveActualDuration(
  videoAsset?: LearningLoopAssetInput,
  audioAsset?: LearningLoopAssetInput,
  constraints?: Record<string, unknown>,
): number {
  if (typeof videoAsset?.durationSeconds === 'number' && videoAsset.durationSeconds > 0) {
    return videoAsset.durationSeconds;
  }
  if (typeof audioAsset?.durationSeconds === 'number' && audioAsset.durationSeconds > 0) {
    return audioAsset.durationSeconds;
  }
  if (typeof constraints?.durationSeconds === 'number') {
    return constraints.durationSeconds as number;
  }
  return 60;
}

function resolveAspectRatio(
  videoAsset?: LearningLoopAssetInput,
  constraints?: Record<string, unknown>,
): '9:16' | '16:9' | '1:1' {
  const rawAspect =
    (videoAsset?.metadata?.aspectRatio as string) ||
    (constraints?.aspectRatio as string) ||
    '9:16';

  if (rawAspect === '16:9' || rawAspect === '1:1') {
    return rawAspect;
  }
  return '9:16';
}

/**
 * Composite extraction of creative variables from mission context and generated media assets.
 */
export function extractCreativeVariables(
  mission: {
    id: string;
    workspaceId: string;
    channels?: string[];
    constraints?: Record<string, unknown>;
    title?: string;
  },
  assets: Array<LearningLoopAssetInput | Record<string, unknown>>,
): ExtractedCreativeVariables {
  const scriptAsset = assets.find((a) => (a as LearningLoopAssetInput).type === 'script') as
    | LearningLoopAssetInput
    | undefined;
  const audioAsset = assets.find((a) => (a as LearningLoopAssetInput).type === 'audio') as
    | LearningLoopAssetInput
    | undefined;
  const videoAsset = assets.find((a) => (a as LearningLoopAssetInput).type === 'video') as
    | LearningLoopAssetInput
    | undefined;

  const { scene0Input, sceneCount } = resolveScene0(scriptAsset, mission.constraints, mission.title);
  const hookStyle = extractHookStyleFromScene0(scene0Input);

  const audioMeta = audioAsset?.metadata || (mission.constraints?.voice as Record<string, unknown> | undefined);
  const { voiceProfile, voiceId } = extractVoiceProfileFromMetadata(audioMeta);

  const actualDuration = resolveActualDuration(videoAsset, audioAsset, mission.constraints);
  const durationPattern = bucketDurationPattern(actualDuration);
  const aspectRatio = resolveAspectRatio(videoAsset, mission.constraints);

  return {
    missionId: mission.id,
    workspaceId: mission.workspaceId,
    hookStyle,
    voiceProfile,
    voiceId,
    durationPattern,
    actualDurationSeconds: actualDuration,
    aspectRatio,
    sceneCount: Math.max(1, sceneCount),
    channels: mission.channels ?? ['tiktok'],
    title: mission.title,
  };
}
