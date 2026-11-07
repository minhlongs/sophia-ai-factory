/**
 * Baoyu-Design × Sophia AI Factory — MIT Schema Bridge Contracts
 *
 * Pure TypeScript data contracts matching `jimliu/baoyu-design` MIT schemas:
 * - `project/design-system.json` & `project/tokens.json` (`claude-design-system`)
 * - `project/canvas.json` & `data-props` Tweaks (`claude-design`)
 * - `comments.json` pin comments (`artifact.mjs comments`)
 * - `Sources` data lineage trace (`claude-dashboard`)
 *
 * @module seed/baoyu-design/baoyu-schema-types
 */

export interface BaoyuCreatedOnFiles {
  readonly v: 1;
  readonly at: string;
}

export interface BaoyuDesignSystemManifest {
  readonly v: 3;
  readonly layout: 'files';
  readonly createdOnFiles: BaoyuCreatedOnFiles;
  readonly title: string;
  readonly namespace: string;
  readonly docs: {
    readonly readme: string;
    readonly sections: readonly string[];
  };
}

export interface BaoyuThemeDefinition {
  readonly id: 'light' | 'dark' | 'high-contrast';
  readonly name: string;
}

export interface BaoyuColorToken {
  readonly name: string;
  readonly value: Readonly<Record<string, string>>;
  readonly usage?: string;
}

export interface BaoyuTokenCatalog {
  readonly version: 1;
  readonly color: {
    readonly themes: readonly BaoyuThemeDefinition[];
    readonly tokens: readonly BaoyuColorToken[];
  };
  readonly type: {
    readonly families: Readonly<Record<string, string>>;
  };
}

export interface BaoyuArtboardFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly title: string;
  readonly expand?: 'fill';
  readonly is_interactive?: boolean;
}

export interface BaoyuInstalledDesignSystemRef {
  readonly title: string;
  readonly namespace: string;
  readonly artifact: string;
  readonly version: string | null;
  readonly copiedAt: string;
}

export interface BaoyuCanvasManifest {
  readonly v: 3;
  readonly createdOnFiles: BaoyuCreatedOnFiles;
  readonly title: string;
  readonly launch: {
    readonly view: 'canvas' | 'focused';
    readonly file?: string;
  };
  readonly boards: Readonly<Record<string, BaoyuArtboardFrame>>;
  readonly order: readonly string[];
  readonly designSystems: readonly BaoyuInstalledDesignSystemRef[];
}

export type BaoyuTweakEditorKind = 'color' | 'number' | 'text' | 'boolean' | 'select';

export interface BaoyuTweakPropSpec {
  readonly key: string;
  readonly labelVi: string;
  readonly labelEn: string;
  readonly editor: BaoyuTweakEditorKind;
  readonly defaultValue: string | number | boolean;
  readonly options?: readonly string[];
  readonly min?: number;
  readonly max?: number;
}

export interface BaoyuCommentItem {
  readonly id: string;
  readonly artboardId: string;
  readonly author: string;
  readonly textVi: string;
  readonly textEn: string;
  readonly resolved: boolean;
  readonly createdAt: string;
}

export interface BaoyuArtboardPreset {
  readonly id: 'shorts_9_16' | 'youtube_16_9' | 'social_1_1';
  readonly file: string;
  readonly aspectRatio: '9:16' | '16:9' | '1:1';
  readonly dimensions: string;
  readonly titleVi: string;
  readonly titleEn: string;
  readonly hookVi: string;
  readonly hookEn: string;
  readonly ctaVi: string;
  readonly ctaEn: string;
}

export interface BaoyuDataSourceTrace {
  readonly id: string;
  readonly metricLabelVi: string;
  readonly metricLabelEn: string;
  readonly d1Table: string;
  readonly queryColumn: string;
  readonly verificationMechanism: string;
  readonly platformFeePolicy: string;
}

export interface OklchColor {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

export interface OklchContrastReport {
  readonly foregroundHex: string;
  readonly backgroundHex: string;
  readonly contrastRatio: number;
  readonly wcagAA: boolean;
  readonly wcagAAA: boolean;
  readonly foregroundOklch: OklchColor;
  readonly backgroundOklch: OklchColor;
  readonly lightnessDelta: number;
  readonly colorBlindSafe: boolean;
}
