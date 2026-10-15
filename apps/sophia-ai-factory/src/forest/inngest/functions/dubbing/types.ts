/**
 * Background Dubbing Orchestration: Types & Interfaces
 *
 * Layer: forest (infrastructure orchestrator & Inngest function)
 *
 * @module forest/inngest/functions/dubbing/types
 */

import type { ApacLocale } from '@/seed/types/dubbing';

export interface DialogueTempoConstraints {
  targetDurationSec?: number;
  sourceWordCount?: number;
}

export interface AiBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
}

export interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

export const LOCALE_NAMES: Record<ApacLocale, string> = {
  vi: 'Vietnamese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
};

export const BRAND_TRANSLATIONS: Record<ApacLocale, string> = {
  vi: 'Sophia AI Factory',
  en: 'Sophia AI Factory',
  ja: 'ソフィアAIファクトリー',
  ko: '소피아 AI 팩토리',
  th: 'Sophia AI Factory',
};

export const CANONICAL_SCRIPTS: Record<ApacLocale, string> = {
  vi: 'Chào mừng bạn đến với Sophia AI Factory, nền tảng tự động hóa sáng tạo nội dung hàng đầu khu vực Châu Á Thái Bình Dương.',
  en: 'Welcome to Sophia AI Factory, the leading autonomous content creation platform in the Asia-Pacific region.',
  ja: 'アジア太平洋地域をリードする自律型コンテンツ制作プラットフォーム、ソフィアAIファクトリーへようこそ。',
  ko: '아시아 태평양 지역을 선도하는 자율형 콘텐츠 제작 플랫폼, 소피아 AI 팩토리에 오신 것을 환영합니다.',
  th: 'ยินดีต้อนรับสู่ Sophia AI Factory แพลตฟอร์มสร้างสรรค์เนื้อหาอัตโนมัติชั้นนำในภูมิภาคเอเชียแปซิฟิก',
};
