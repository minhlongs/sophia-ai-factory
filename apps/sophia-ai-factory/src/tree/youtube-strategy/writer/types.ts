/**
 * @file types.ts
 * @description Types and interfaces for YouTube script strategy, hooks, and formatted scripts
 */

import type { ExtractedClaim, ClaimSource } from '../claim-extractor';

export interface ScriptStrategy {
  readonly topic: string;
  readonly angle: string;
  readonly contentType: string;
  readonly targetAudience: string;
  readonly keywords: readonly string[];
  readonly researchSources?: readonly ClaimSource[];
}

export interface ScriptHook {
  readonly type: string;
  readonly text: string;
  readonly duration: string;
}

export interface ScriptIntroduction {
  readonly greeting: string;
  readonly topicIntro: string;
  readonly valueProposition: string;
  readonly credibility: string;
  readonly duration: string;
}

export interface ScriptMainContent {
  readonly sections: readonly ScriptContentSection[];
  readonly totalDuration: number;
}

export interface ScriptContentSection {
  readonly type: string;
  readonly title: string;
  readonly content: readonly string[];
  readonly duration: number;
}

export interface ScriptConclusion {
  readonly recap: readonly string[];
  readonly finalThought: string;
  readonly duration: string;
}

export interface ScriptCTA {
  readonly subscribe: string;
  readonly like: string;
  readonly comment: string;
  readonly nextVideo: string;
  readonly duration: string;
}

export interface GeneratedScript {
  readonly title: string;
  readonly hook: ScriptHook;
  readonly introduction: ScriptIntroduction;
  readonly mainContent: ScriptMainContent;
  readonly conclusion: ScriptConclusion;
  readonly callToAction: ScriptCTA;
  readonly duration: string;
  readonly tone: string;
  readonly pacing: string;
  readonly keywords: readonly string[];
  readonly claims: readonly ExtractedClaim[];
  readonly fullScript: string;
}
