export interface TalkingHeadInput {
  avatarId?: string;
  avatarImageUrl?: string;
  avatarImageData?: string;
  avatarImageFormat?: string;
  script: string;
  voiceId?: string;
  language?: string;
  resolution?: string;
  outputFormat?: string;
  expression?: string;
  maxDurationSeconds?: number;
  subtitles?: { enabled: boolean };
  backgroundMusicUrl?: string;
}
