/**
 * E2E Test Fixtures for Sophia AI Factory Testing
 */

export interface TranscriptSegment {
  index: number;
  startMs: number;
  endMs: number;
  speakerId?: string;
  text: string;
}

export type SupportedLocale = 'en' | 'vi' | 'ja' | 'ko' | 'th';

export const SAMPLE_TRANSCRIPT_EN: TranscriptSegment[] = [
  { index: 1, startMs: 0, endMs: 2500, speakerId: 'spk_1', text: 'Welcome to Sophia AI Factory automated video generation.' },
  { index: 2, startMs: 2600, endMs: 5800, speakerId: 'spk_1', text: 'Today we will transform your short-form videos across Asia-Pacific.' },
  { index: 3, startMs: 6000, endMs: 9500, speakerId: 'spk_1', text: 'With five languages and instant syndication, your reach multiplies ten times.' },
];

export const SAMPLE_TRANSCRIPT_VI: TranscriptSegment[] = [
  { index: 1, startMs: 0, endMs: 2500, speakerId: 'spk_1', text: 'Chào mừng bạn đến với cỗ máy sản xuất video tự động Sophia AI.' },
  { index: 2, startMs: 2600, endMs: 5800, speakerId: 'spk_1', text: 'Hôm nay chúng ta sẽ mở rộng kênh video ngắn khắp khu vực Châu Á - Thái Bình Dương.' },
  { index: 3, startMs: 6000, endMs: 9500, speakerId: 'spk_1', text: 'Với 5 ngôn ngữ và phát hành tự động, tiếp cận của bạn sẽ tăng gấp 10 lần.' },
];

export const SAMPLE_TRANSCRIPT_JA: TranscriptSegment[] = [
  { index: 1, startMs: 0, endMs: 2500, speakerId: 'spk_1', text: 'ソフィアAIファクトリーの自動動画制作システムへようこそ。' },
  { index: 2, startMs: 2600, endMs: 5800, speakerId: 'spk_1', text: '本日はアジア太平洋地域向けにショート動画をグローバル展開します。' },
  { index: 3, startMs: 6000, endMs: 9500, speakerId: 'spk_1', text: '5つの言語と自動投稿メッシュにより、リーチ数は瞬時に10倍になります。' },
];

export const SAMPLE_TRANSCRIPT_KO: TranscriptSegment[] = [
  { index: 1, startMs: 0, endMs: 2500, speakerId: 'spk_1', text: '소피아 AI 팩토리의 자동 비디오 생성 시스템에 오신 것을 환영합니다.' },
  { index: 2, startMs: 2600, endMs: 5800, speakerId: 'spk_1', text: '오늘은 아시아 태평양 전역으로 숏폼 비디오를 확장하는 방법을 알아봅니다.' },
  { index: 3, startMs: 6000, endMs: 9500, speakerId: 'spk_1', text: '5개 언어 현지화와 자동 배포를 통해 도달 범위가 10배 증가합니다.' },
];

export const SAMPLE_TRANSCRIPT_TH: TranscriptSegment[] = [
  { index: 1, startMs: 0, endMs: 2500, speakerId: 'spk_1', text: 'ยินดีต้อนรับสู่ระบบสร้างวิดีโออัตโนมัติ Sophia AI Factory' },
  { index: 2, startMs: 2600, endMs: 5800, speakerId: 'spk_1', text: 'วันนี้เราจะนำวิดีโอสั้นของคุณขยายสู่ตลาดเอเชียแปซิฟิก' },
  { index: 3, startMs: 6000, endMs: 9500, speakerId: 'spk_1', text: 'ด้วย 5 ภาษาและการเผยแพร่อัตโนมัติ ยอดการเข้าถึงจะเพิ่มขึ้น 10 เท่า' },
];

export const MOCK_APAC_VOICE_PRESETS = [
  { id: 'alex-en-m', displayName: 'Alex', language: 'en', gender: 'male', minTier: 'BASIC' },
  { id: 'sophia-en-f', displayName: 'Sophia', language: 'en', gender: 'female', minTier: 'BASIC' },
  { id: 'nam-vi-m', displayName: 'Nam', language: 'vi', gender: 'male', minTier: 'BASIC' },
  { id: 'linh-vi-f', displayName: 'Linh', language: 'vi', gender: 'female', minTier: 'BASIC' },
  { id: 'kenji-ja-m', displayName: 'Kenji', language: 'ja', gender: 'male', minTier: 'PREMIUM' },
  { id: 'sakura-ja-f', displayName: 'Sakura', language: 'ja', gender: 'female', minTier: 'PREMIUM' },
  { id: 'minho-ko-m', displayName: 'Min-ho', language: 'ko', gender: 'male', minTier: 'PREMIUM' },
  { id: 'jisoo-ko-f', displayName: 'Ji-soo', language: 'ko', gender: 'female', minTier: 'PREMIUM' },
  { id: 'somchai-th-m', displayName: 'Somchai', language: 'th', gender: 'male', minTier: 'PREMIUM' },
  { id: 'ploy-th-f', displayName: 'Ploy', language: 'th', gender: 'female', minTier: 'PREMIUM' },
];

export const MOCK_CREATOR_TEMPLATE_PAYLOAD = {
  title: 'APAC Viral Hook: 3 Mistakes That Kill Your Retention',
  niche: 'saas_marketing',
  scriptTemplate: 'Hook: Stop doing {{mistake_1}} right now! Here is why...',
  storyboardJson: JSON.stringify({
    scenes: [
      { id: 1, duration: 3, prompt: 'Dramatic camera zoom on frustrated founder' },
      { id: 2, duration: 4, prompt: 'Chart showing retention plummeting 80%' },
      { id: 3, duration: 5, prompt: 'Sophia AI dashboard revealing 10x turnaround' },
    ],
  }),
  visualStylePrompt: 'Hyper-realistic 4k studio lighting, cinematic anamorphic lens, neon teal accents',
  backgroundMusicUrl: 'https://cdn.agencyos.network/audio/viral-tech-beat-01.mp3',
  priceCents: 299, // $2.99
  royaltyPercent: 70.0,
};
