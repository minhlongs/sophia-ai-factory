export interface OpenClawCommandContext {
  chatId: string;
  userId?: string;
  rawArg?: string;
}

export interface Free100RedeemParams {
  code: string;
  email: string;
  tier: 'MASTER';
}

export interface PublishScheduleParams {
  userId: string;
  videoId: string;
  channelId: string;
  scheduledAt: number;
  caption?: string;
}

export interface SeoScriptParams {
  userId: string;
  topic: string;
  keywords: string[];
}

export interface CloneVoiceParams {
  userId: string;
  name: string;
  audioUrls: string[];
}

export interface TranslateParams {
  userId: string;
  text: string;
  fromLang: string;
  toLang: string;
}

export interface EmbedAffiliateParams {
  userId: string;
  videoId?: string;
  baseBody?: string;
}
