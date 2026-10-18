/**
 * @file hook-archetype-definitions.ts
 * @description Psychological hook archetype definitions for viral short-form video hooks.
 * @layer tree
 */

import type { HookArchetype } from '@/seed/types/growth';
import type { ArchetypeDefinition } from './types';

export const ARCHETYPE_DEFINITIONS: Record<HookArchetype, ArchetypeDefinition> = {
  curiosity_gap: {
    archetype: 'curiosity_gap',
    name: 'Curiosity Gap',
    nameVi: 'Khoảng Trống Tò Mò',
    psychologicalMechanism: 'Withholds a critical piece of information, triggering a dopamine loop that forces retention.',
    idealDurationSec: 3,
    deliveryStyle: 'Intriguing, mysterious, fast-paced whisper or punchy assertion.',
  },
  shock_stat: {
    archetype: 'shock_stat',
    name: 'Shocking Statistic',
    nameVi: 'Số Liệu Gây Sốc',
    psychologicalMechanism: 'Presents an undeniable numerical metric that shatters the viewer’s cognitive baseline.',
    idealDurationSec: 4,
    deliveryStyle: 'Authoritative, urgent, accompanied by bold numerical overlay.',
  },
  direct_question: {
    archetype: 'direct_question',
    name: 'Direct Question',
    nameVi: 'Câu Hỏi Trực Diện',
    psychologicalMechanism: 'Forces the viewer’s brain into immediate self-examination and binary agreement.',
    idealDurationSec: 3,
    deliveryStyle: 'Direct eye contact, conversational, piercing tone.',
  },
  problem_solution: {
    archetype: 'problem_solution',
    name: 'Problem-Solution Pivot',
    nameVi: 'Đảo Ngược Vấn Đề - Giải Pháp',
    psychologicalMechanism: 'Immediately triggers loss aversion by naming the exact friction point, followed by immediate relief.',
    idealDurationSec: 5,
    deliveryStyle: 'Frustrated initial cadence rapidly shifting to triumphant clarity.',
  },
  contrarian: {
    archetype: 'contrarian',
    name: 'Contrarian Stance',
    nameVi: 'Quan Điểm Ngược Dòng',
    psychologicalMechanism: 'Debunks widespread industry consensus, triggering pattern interrupt and curiosity.',
    idealDurationSec: 4,
    deliveryStyle: 'Bold, provocative, unapologetic call-out.',
  },
};
