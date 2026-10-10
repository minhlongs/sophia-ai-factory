/**
 * Help Video Mutation Types & Localization Resolver
 *
 * Layer: tree/help/mutation-ops
 *
 * @module tree/help/mutation-ops/types
 */

import type {
  HelpVideo,
  LocalizedHelpVideo,
  HelpVideoCategory,
  CreateHelpVideoInput,
  UpdateHelpVideoInput,
  MarkWatchedInput,
  UnmarkWatchedInput,
  HelpVideoProgress,
} from '../types';

export type {
  HelpVideo,
  LocalizedHelpVideo,
  HelpVideoCategory,
  CreateHelpVideoInput,
  UpdateHelpVideoInput,
  MarkWatchedInput,
  UnmarkWatchedInput,
  HelpVideoProgress,
};

/**
 * Resolves localized title and description fields for a help video.
 */
export function resolveLocalized(video: HelpVideo, locale: 'en' | 'vi'): LocalizedHelpVideo {
  return {
    ...video,
    title: locale === 'en' ? video.title_en : video.title_vi,
    description: locale === 'en' ? video.description_en : video.description_vi,
    locale,
  };
}
