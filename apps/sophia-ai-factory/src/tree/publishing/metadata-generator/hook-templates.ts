/**
 * @file hook-templates.ts
 * @description Character limits, platform constraints, and multilingual hook templates.
 * @layer tree
 */

import type { ApacLanguage, PlatformType } from '@/seed/types/apac-syndication';
import type { HookTemplateMap } from './types';

// ─── Character Limits & Platform Constraints ────────────────────────────────

export const PLATFORM_LIMITS: Record<PlatformType, { maxTitleLength: number; maxDescriptionLength: number }> = {
  youtube_shorts: { maxTitleLength: 100, maxDescriptionLength: 5000 },
  tiktok: { maxTitleLength: 150, maxDescriptionLength: 2200 },
  instagram_reels: { maxTitleLength: 150, maxDescriptionLength: 2200 },
  facebook_reels: { maxTitleLength: 150, maxDescriptionLength: 2200 },
};

// ─── Multilingual Psychological Hook Templates ──────────────────────────────

export const HOOK_TEMPLATES_BY_LANGUAGE: Record<ApacLanguage, HookTemplateMap> = {
  vi: {
    curiosity_gap: (t) => `Bí Mật Đằng Sau ${t} Mà 99% Người Không Hề Biết`,
    shock_stat: (t) => `93% Thất Bại Với ${t} — Trừ Khi Bạn Biết Điều Này!`,
    direct_question: (t) => `Bạn Đang Lãng Phí 4 Giờ Mỗi Ngày Vì Bỏ Qua ${t}?`,
    problem_solution: (t) => `Cách Tự Động Hóa ${t} Trong 5 Phút Cực Đơn Giản`,
    contrarian: (t) => `Đừng Làm ${t} Theo Cách Cũ Nữa: Đây Là Xu Hướng 2026`,
  },
  en: {
    curiosity_gap: (t) => `The Hidden Secret About ${t} 99% Of People Don't Know`,
    shock_stat: (t) => `93% Fail At ${t} — Unless They Use This Exact Blueprint`,
    direct_question: (t) => `Are You Still Wasting 4 Hours A Day Ignoring ${t}?`,
    problem_solution: (t) => `How To Automate ${t} In 5 Minutes (Step-By-Step)`,
    contrarian: (t) => `Stop Doing ${t} The Old Way: The 2026 AI Framework`,
  },
  ja: {
    curiosity_gap: (t) => `99%が知らない【${t}】の驚愕の真実とは？`,
    shock_stat: (t) => `【衝撃】93%が挫折する${t}を完全攻略する裏ワザ`,
    direct_question: (t) => `まだ${t}で毎日3時間も無駄にしていませんか？`,
    problem_solution: (t) => `たった5分で自動化！プロが教える${t}実践術`,
    contrarian: (t) => `昔のやり方は今すぐ捨てろ！2026年最新の${t}攻略法`,
  },
  ko: {
    curiosity_gap: (t) => `99%가 전혀 모르는 ${t}의 숨겨진 진실`,
    shock_stat: (t) => `93%가 실패하는 ${t}, 이 공식 하나로 완벽 해결!`,
    direct_question: (t) => `아직도 ${t} 때문에 매일 3시간씩 낭비하고 계신가요?`,
    problem_solution: (t) => `단 5분 만에 끝내는 ${t} 자동화 실전 가이드`,
    contrarian: (t) => `${t} 더 이상 옛날 방식으로 하지 마세요 (2026 최신 AI)`,
  },
  th: {
    curiosity_gap: (t) => `ความลับของ ${t} ที่คน 99% ยังไม่เคยรู้`,
    shock_stat: (t) => `93% ล้มเหลวกับ ${t} ถ้าไม่ใช้วิธีนี้เด็ดขาด!`,
    direct_question: (t) => `คุณยังเสียเวลา 4 ชั่วโมงต่อวันกับ ${t} อยู่หรือเปล่า?`,
    problem_solution: (t) => `วิธีเปลี่ยน ${t} ให้เป็นระบบอัตโนมัติใน 5 นาที`,
    contrarian: (t) => `หยุดทำ ${t} แบบเดิมๆ ได้แล้ว — นี่คือเทคนิคใหม่ปี 2026`,
  },
};
